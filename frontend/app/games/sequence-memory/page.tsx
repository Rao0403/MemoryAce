"use client";

import { useEffect, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import { extendSequence, getSequenceScore, randomCell, SEQUENCE_GRID_SIZE } from "@/lib/game-logic/sequenceMemory";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "playback" | "input" | "gameover";

const GAME_KEY = "sequence_memory" as const;

export default function SequenceMemoryPage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("Watch the sequence, then repeat it exactly.");

  const timerRefs = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const stepStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  function clearTimers() {
    timerRefs.current.forEach((timer) => clearTimeout(timer));
    timerRefs.current = [];
  }

  function playSequence(nextSequence: number[]) {
    clearTimers();
    setPhase("playback");
    setPlayerStep(0);
    setActiveCell(null);

    nextSequence.forEach((cell, index) => {
      const start = 240 + index * 680;
      timerRefs.current.push(
        setTimeout(() => {
          setActiveCell(cell);
        }, start),
      );
      timerRefs.current.push(
        setTimeout(() => {
          setActiveCell(null);
        }, start + 420),
      );
    });

    const inputStart = 260 + nextSequence.length * 680;
    timerRefs.current.push(
      setTimeout(() => {
        stepStartedAtRef.current = Date.now();
        setPhase("input");
        setStatusText("Your turn. Repeat the full pattern.");
      }, inputStart),
    );
  }

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    const first = [randomCell()];
    setSequence(first);
    setStatusText("Level 1 sequence incoming.");
    playSequence(first);
  }

  async function onCellClick(cell: number) {
    if (phase !== "input") return;

    const reactionMs = stepStartedAtRef.current ? Date.now() - stepStartedAtRef.current : null;
    const expected = sequence[playerStep];
    const scoreBefore = getSequenceScore(sequence.length);

    setActiveCell(cell);
    const offTimer = setTimeout(() => setActiveCell(null), 120);
    timerRefs.current.push(offTimer);

    if (cell !== expected) {
      actions.recordTrial({
        difficulty_level: sequence.length,
        reaction_ms: reactionMs,
        correct: false,
        score_before: scoreBefore,
        score_after: scoreBefore,
        event_payload: {
          sequence_length: sequence.length,
          tapped_cell: cell,
          expected_cell: expected,
          player_step: playerStep + 1,
          wrong_step_index: playerStep + 1,
        },
      });

      const score = getSequenceScore(sequence.length);
      setPhase("gameover");
      setStatusText(`Wrong tap. Final score: ${score}.`);
      await actions.finishTrackedRun({ finalScore: score });
      return;
    }

    const nextStep = playerStep + 1;
    if (nextStep < sequence.length) {
      actions.recordTrial({
        difficulty_level: sequence.length,
        reaction_ms: reactionMs,
        correct: true,
        score_before: scoreBefore,
        score_after: scoreBefore,
        event_payload: {
          sequence_length: sequence.length,
          tapped_cell: cell,
          expected_cell: expected,
          player_step: playerStep + 1,
          wrong_step_index: null,
        },
      });
      setPlayerStep(nextStep);
      stepStartedAtRef.current = Date.now();
      return;
    }

    actions.recordTrial({
      difficulty_level: sequence.length,
      reaction_ms: reactionMs,
      correct: true,
      score_before: scoreBefore,
      score_after: sequence.length,
      event_payload: {
        sequence_length: sequence.length,
        tapped_cell: cell,
        expected_cell: expected,
        player_step: playerStep + 1,
        wrong_step_index: null,
      },
    });

    const extended = extendSequence(sequence);
    setSequence(extended);
    setStatusText(`Correct. Level ${extended.length} incoming.`);
    playSequence(extended);
  }

  return (
    <GameShell
      title={state.definition.heroTitle}
      subtitle={state.definition.subtitle}
      hudItems={[
        { label: "Level", value: `${Math.max(1, sequence.length)}` },
        { label: "Step", value: `${Math.min(playerStep + 1, Math.max(sequence.length, 1))}` },
      ]}
      statusText={statusText}
      noticeText={state.noticeText}
      playerName={state.playerName}
      hasPlayerName={state.hasPlayerName}
      stats={state.stats}
      leaderboardRows={state.leaderboardRows}
      isLoadingMeta={state.isLoadingMeta}
      isSavingResult={state.isSavingResult}
      metaError={state.metaError}
      onPlayerNameSaved={actions.savePlayerName}
    >
      {phase === "idle" && (
        <div className="center-stack">
          <h2>Ready?</h2>
          <p className="muted">
            {state.hasPlayerName
              ? "Memorize each glow and replay in exact order."
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Game
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="sequence-grid" aria-label="3 by 3 sequence grid">
          {Array.from({ length: SEQUENCE_GRID_SIZE }).map((_, cell) => (
            <button
              key={cell}
              type="button"
              className={`sequence-cell ${activeCell === cell ? "active" : ""}`}
              onClick={() => {
                void onCellClick(cell);
              }}
              disabled={phase === "playback" || phase === "gameover"}
            />
          ))}
        </div>
      )}

      {phase === "gameover" && (
        <div className="center-stack">
          <p className="muted">{state.isSavingResult ? "Saving score..." : "Score recorded."}</p>
          <button className="btn secondary" type="button" onClick={() => void startGame()}>
            Play Again
          </button>
        </div>
      )}
    </GameShell>
  );
}
