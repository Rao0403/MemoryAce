"use client";

import { useEffect, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import { generateNumber, getNumberMemoryScore, getRevealMs } from "@/lib/game-logic/numberMemory";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "showing" | "input" | "gameover";

const GAME_KEY = "number_memory" as const;

export default function NumberMemoryPage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [shownNumber, setShownNumber] = useState("");
  const [answer, setAnswer] = useState("");
  const [statusText, setStatusText] = useState("Start at 1 digit and climb forever.");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputStartedAtRef = useRef<number | null>(null);
  const revealMs = getRevealMs(level);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function runLevel(nextLevel: number) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const generated = generateNumber(nextLevel);
    const nextRevealMs = getRevealMs(nextLevel);

    setLevel(nextLevel);
    setShownNumber(generated);
    setAnswer("");
    setPhase("showing");
    setStatusText(`Level ${nextLevel}: memorize quickly.`);

    timeoutRef.current = setTimeout(() => {
      inputStartedAtRef.current = Date.now();
      setPhase("input");
      setStatusText(`Type the ${nextLevel}-digit number.`);
    }, nextRevealMs);
  }

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }
    runLevel(1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = answer.trim();
    if (!normalized) {
      setStatusText("Type your answer before submitting.");
      return;
    }

    const reactionMs = inputStartedAtRef.current ? Date.now() - inputStartedAtRef.current : null;
    const scoreBefore = getNumberMemoryScore(level);

    if (normalized === shownNumber) {
      actions.recordTrial({
        difficulty_level: level,
        reaction_ms: reactionMs,
        correct: true,
        score_before: scoreBefore,
        score_after: level,
        event_payload: {
          digits_shown: shownNumber.length,
          reveal_ms: revealMs,
          input_length: normalized.length,
          exact_match: true,
        },
      });

      const next = level + 1;
      setStatusText(`Correct. Next: ${next} digits.`);
      runLevel(next);
      return;
    }

    const score = getNumberMemoryScore(level);
    actions.recordTrial({
      difficulty_level: level,
      reaction_ms: reactionMs,
      correct: false,
      score_before: scoreBefore,
      score_after: score,
      event_payload: {
        digits_shown: shownNumber.length,
        reveal_ms: revealMs,
        input_length: normalized.length,
        exact_match: false,
      },
    });

    setPhase("gameover");
    setStatusText(`Wrong. Number was ${shownNumber}. Final score: ${score}.`);
    await actions.finishTrackedRun({ finalScore: score });
  }

  return (
    <GameShell
      title={state.definition.heroTitle}
      subtitle={state.definition.subtitle}
      hudItems={[
        { label: "Level", value: `${level}` },
        { label: "Reveal", value: `${revealMs}ms` },
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
              ? "Memorize what you see before it fades."
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Game
          </button>
        </div>
      )}

      {phase === "showing" && (
        <div className="center-stack">
          <p className="muted">Memorize</p>
          <div className="memory-number pulse">{shownNumber}</div>
        </div>
      )}

      {phase === "input" && (
        <form onSubmit={(event) => void handleSubmit(event)} className="center-stack">
          <p className="muted">Enter the hidden number</p>
          <input
            className="text-input big"
            inputMode="numeric"
            value={answer}
            onChange={(event) => setAnswer(event.target.value.replace(/[^0-9]/g, ""))}
            autoFocus
          />
          <button className="btn secondary" type="submit">
            Submit
          </button>
        </form>
      )}

      {phase === "gameover" && (
        <div className="center-stack">
          <h2>Round Over</h2>
          <p className="muted">{state.isSavingResult ? "Saving score..." : "Score recorded."}</p>
          <button className="btn" type="button" onClick={() => void startGame()}>
            Play Again
          </button>
        </div>
      )}
    </GameShell>
  );
}
