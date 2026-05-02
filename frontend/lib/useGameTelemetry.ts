"use client";

import { useEffect, useRef } from "react";

import { endGameRun, sendRunEventsBatch, startGameRun, type TrialEventPayload } from "@/lib/api";
import type { GameKey } from "@/lib/constants";

type EndReason = "completed" | "abandoned" | "timeout" | "quit";

type RecordTrialInput = Omit<TrialEventPayload, "trial_index" | "occurred_at" | "event_schema_version"> & {
  occurred_at?: string;
  event_schema_version?: number;
};

const EVENT_SCHEMA_VERSION = 1;
const MAX_BATCH_SIZE = 8;

export function useGameTelemetry(game: GameKey, playerName: string) {
  const runIdRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const trialIndexRef = useRef(0);
  const pendingEventsRef = useRef<TrialEventPayload[]>([]);

  async function flushPendingEvents() {
    const runId = runIdRef.current;
    if (!runId || pendingEventsRef.current.length === 0) {
      return;
    }

    const batch = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    try {
      await sendRunEventsBatch({ runId, events: batch });
    } catch {
      pendingEventsRef.current = [...batch, ...pendingEventsRef.current];
    }
  }

  async function startRun() {
    activeRef.current = true;
    trialIndexRef.current = 0;
    pendingEventsRef.current = [];
    runIdRef.current = null;

    try {
      const run = await startGameRun({
        playerName: playerName.trim() || undefined,
        game,
        eventSchemaVersion: EVENT_SCHEMA_VERSION,
      });
      runIdRef.current = run.run_id;
      await flushPendingEvents();
    } catch {
      runIdRef.current = null;
    }
  }

  function recordTrial(input: RecordTrialInput) {
    if (!activeRef.current) {
      return;
    }

    const nextTrialIndex = trialIndexRef.current + 1;
    trialIndexRef.current = nextTrialIndex;

    pendingEventsRef.current.push({
      trial_index: nextTrialIndex,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      event_name: input.event_name ?? "trial_resolved",
      difficulty_level: input.difficulty_level,
      reaction_ms: input.reaction_ms ?? null,
      correct: input.correct,
      score_before: input.score_before,
      score_after: input.score_after,
      lives_before: input.lives_before ?? null,
      lives_after: input.lives_after ?? null,
      event_payload: input.event_payload ?? {},
      event_schema_version: input.event_schema_version ?? EVENT_SCHEMA_VERSION,
    });

    if (pendingEventsRef.current.length >= MAX_BATCH_SIZE) {
      void flushPendingEvents();
    }
  }

  async function endRun(params: {
    finalScore: number;
    endReason?: EndReason;
    finalLives?: number;
    totalTrials?: number;
  }) {
    if (!activeRef.current) {
      return;
    }

    await flushPendingEvents();

    const runId = runIdRef.current;
    const totalTrials = params.totalTrials ?? trialIndexRef.current;

    if (runId) {
      try {
        await endGameRun({
          runId,
          finalScore: params.finalScore,
          endReason: params.endReason ?? "completed",
          finalLives: params.finalLives,
          totalTrials,
        });
      } catch {
        // Best effort telemetry; gameplay should continue even if logging fails.
      }
    }

    runIdRef.current = null;
    activeRef.current = false;
    trialIndexRef.current = 0;
    pendingEventsRef.current = [];
  }

  function getTrialCount(): number {
    return trialIndexRef.current;
  }

  useEffect(() => {
    function handlePageHide() {
      void flushPendingEvents();
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void flushPendingEvents();
    };
  }, []);

  return {
    startRun,
    recordTrial,
    flushPendingEvents,
    endRun,
    getTrialCount,
  };
}
