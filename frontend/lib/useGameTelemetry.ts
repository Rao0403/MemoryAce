"use client";

import { useEffect, useRef } from "react";

import {
  endGameRun,
  sendRunEventsBatch,
  sendRunEventsBatchBeacon,
  startGameRun,
  type TrialEventPayload,
} from "@/lib/api";
import type { GameKey } from "@/lib/constants";

export type EndReason = "completed" | "abandoned" | "timeout" | "quit";

export type GameTelemetryEvent = Omit<TrialEventPayload, "trial_index" | "occurred_at" | "event_schema_version"> & {
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
  const flushInFlightRef = useRef<Promise<void> | null>(null);
  const endInFlightRef = useRef<Promise<void> | null>(null);
  const startInFlightRef = useRef<Promise<boolean> | null>(null);
  const flushPendingEventsRef = useRef<(options?: { preferBeacon?: boolean }) => Promise<void>>(async () => {});

  async function flushPendingEvents(options?: { preferBeacon?: boolean }) {
    const runId = runIdRef.current;
    if (!runId || pendingEventsRef.current.length === 0) {
      return;
    }

    if (flushInFlightRef.current) {
      await flushInFlightRef.current;
      if (pendingEventsRef.current.length > 0) {
        return flushPendingEvents(options);
      }
      return;
    }

    const batch = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    if (options?.preferBeacon && sendRunEventsBatchBeacon({ runId, events: batch })) {
      return;
    }

    flushInFlightRef.current = (async () => {
      try {
        await sendRunEventsBatch({
          runId,
          events: batch,
          keepalive: options?.preferBeacon ?? false,
        });
      } catch {
        pendingEventsRef.current = [...batch, ...pendingEventsRef.current];
      } finally {
        flushInFlightRef.current = null;
      }
    })();

    await flushInFlightRef.current;

    if (pendingEventsRef.current.length > 0 && activeRef.current) {
      await flushPendingEvents();
    }
  }

  flushPendingEventsRef.current = flushPendingEvents;

  async function startRun(): Promise<boolean> {
    if (activeRef.current) {
      return true;
    }

    if (startInFlightRef.current) {
      return startInFlightRef.current;
    }

    trialIndexRef.current = 0;
    pendingEventsRef.current = [];
    runIdRef.current = null;

    startInFlightRef.current = (async () => {
      try {
        const run = await startGameRun({
          playerName: playerName.trim() || undefined,
          game,
          eventSchemaVersion: EVENT_SCHEMA_VERSION,
        });
        runIdRef.current = run.run_id;
        activeRef.current = true;
        await flushPendingEvents();
        return true;
      } catch {
        activeRef.current = false;
        runIdRef.current = null;
        pendingEventsRef.current = [];
        return false;
      } finally {
        startInFlightRef.current = null;
      }
    })();

    return startInFlightRef.current;
  }

  function recordTrial(input: GameTelemetryEvent) {
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

    if (pendingEventsRef.current.length >= MAX_BATCH_SIZE && !flushInFlightRef.current) {
      void flushPendingEvents();
    }
  }

  async function endRun(params: {
    finalScore: number;
    endReason?: EndReason;
    finalLives?: number;
    totalTrials?: number;
  }) {
    if (!activeRef.current && !endInFlightRef.current) {
      return;
    }

    if (endInFlightRef.current) {
      await endInFlightRef.current;
      return;
    }

    endInFlightRef.current = (async () => {
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
    })();

    try {
      await endInFlightRef.current;
    } finally {
      endInFlightRef.current = null;
    }
  }

  function getTrialCount(): number {
    return trialIndexRef.current;
  }

  useEffect(() => {
    function handlePageHide() {
      void flushPendingEventsRef.current({ preferBeacon: true });
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void flushPendingEventsRef.current({ preferBeacon: true });
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
