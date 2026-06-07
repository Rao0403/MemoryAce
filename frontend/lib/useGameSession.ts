"use client";

import { useEffect, useMemo, useState } from "react";

import { getStoredPlayerName, setStoredPlayerName } from "@/components/PlayerNameInput";
import {
  fetchLeaderboard,
  fetchStats,
  submitScore,
  type LeaderboardRow,
  type PlayerGameStats,
} from "@/lib/api";
import { GAME_DEFINITIONS, type GameDefinition, type GameKey } from "@/lib/constants";
import { useGameTelemetry, type EndReason, type GameTelemetryEvent } from "@/lib/useGameTelemetry";

export type GameResultSummary = {
  finalScore: number;
  finalLives?: number;
  totalTrials?: number;
  endReason?: EndReason;
};

export type GameSessionState = {
  definition: GameDefinition;
  playerName: string;
  hasPlayerName: boolean;
  stats: PlayerGameStats | null;
  leaderboardRows: LeaderboardRow[];
  isLoadingMeta: boolean;
  isSavingResult: boolean;
  metaError: string;
  noticeText: string;
};

export function useGameSession(game: GameKey) {
  const definition = GAME_DEFINITIONS[game];
  const [playerName, setPlayerName] = useState("");
  const [stats, setStats] = useState<PlayerGameStats | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const telemetry = useGameTelemetry(game, playerName);
  const hasPlayerName = useMemo(() => playerName.trim().length >= 2, [playerName]);

  useEffect(() => {
    setPlayerName(getStoredPlayerName());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setIsLoadingMeta(true);
      setMetaError("");

      try {
        const [leaderboard, personal] = await Promise.all([
          fetchLeaderboard(game),
          hasPlayerName ? fetchStats({ playerName, game }) : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setLeaderboardRows(leaderboard);
        setStats(personal);
      } catch {
        if (cancelled) {
          return;
        }
        setMetaError("Could not load scores right now.");
        if (!hasPlayerName) {
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMeta(false);
        }
      }
    }

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [game, hasPlayerName, playerName]);

  async function refreshMeta() {
    setIsLoadingMeta(true);
    setMetaError("");

    try {
      const [leaderboard, personal] = await Promise.all([
        fetchLeaderboard(game),
        hasPlayerName ? fetchStats({ playerName, game }) : Promise.resolve(null),
      ]);
      setLeaderboardRows(leaderboard);
      setStats(personal);
    } catch {
      setMetaError("Could not load scores right now.");
      if (!hasPlayerName) {
        setStats(null);
      }
    } finally {
      setIsLoadingMeta(false);
    }
  }

  function savePlayerName(nextName: string) {
    const normalized = nextName.trim();
    if (!normalized) {
      return;
    }
    setStoredPlayerName(normalized);
    setPlayerName(normalized);
    setNoticeText("");
  }

  async function startTrackedRun(): Promise<boolean> {
    if (!hasPlayerName) {
      setNoticeText("Save a player name to start tracked runs on this device.");
      return false;
    }

    const started = await telemetry.startRun();
    if (!started) {
      setNoticeText("Could not reach the backend to start this run.");
      return false;
    }

    setNoticeText("");
    return true;
  }

  function recordTrial(event: GameTelemetryEvent) {
    telemetry.recordTrial(event);
  }

  async function finishTrackedRun(result: GameResultSummary): Promise<boolean> {
    await telemetry.endRun({
      finalScore: result.finalScore,
      finalLives: result.finalLives,
      totalTrials: result.totalTrials,
      endReason: result.endReason ?? "completed",
    });

    if (!hasPlayerName) {
      setNoticeText("Run ended, but no player name is stored for score syncing.");
      return false;
    }

    setIsSavingResult(true);
    try {
      const personal = await submitScore({
        playerName,
        game,
        score: result.finalScore,
      });
      setStats(personal);
      setNoticeText("");

      try {
        const leaderboard = await fetchLeaderboard(game);
        setLeaderboardRows(leaderboard);
      } catch {
        setNoticeText("Score saved, but leaderboard refresh failed.");
      }

      return true;
    } catch {
      setNoticeText("Run ended, but score sync failed.");
      return false;
    } finally {
      setIsSavingResult(false);
    }
  }

  return {
    state: {
      definition,
      playerName,
      hasPlayerName,
      stats,
      leaderboardRows,
      isLoadingMeta,
      isSavingResult,
      metaError,
      noticeText,
    } satisfies GameSessionState,
    actions: {
      savePlayerName,
      refreshMeta,
      startTrackedRun,
      recordTrial,
      finishTrackedRun,
      clearNotice: () => setNoticeText(""),
      getTrialCount: telemetry.getTrialCount,
    },
  };
}
