"use client";

import { useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import { pickNextWord, randomFrom, resolveVerbalGuess, WORD_BANK } from "@/lib/game-logic/verbalMemory";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "playing" | "gameover";

const GAME_KEY = "verbal_memory" as const;
const MAX_LIVES = 3;

export default function VerbalMemoryPage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [seenWords, setSeenWords] = useState<string[]>([]);
  const [statusText, setStatusText] = useState("Click New if first time this round, Seen if repeated.");

  const wordShownAtRef = useRef<number | null>(null);
  const seenCount = useMemo(() => new Set(seenWords).size, [seenWords]);

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    setLives(MAX_LIVES);
    setScore(0);
    setSeenWords([]);
    setPhase("playing");
    const firstWord = randomFrom(WORD_BANK);
    wordShownAtRef.current = Date.now();
    setCurrentWord(firstWord);
    setStatusText("Round started. Decide if each word is Seen or New.");
  }

  async function handleGuess(guessSeen: boolean) {
    if (phase !== "playing" || !currentWord) return;

    const reactionMs = wordShownAtRef.current ? Date.now() - wordShownAtRef.current : null;
    const result = resolveVerbalGuess({
      currentWord,
      seenWords,
      guessSeen,
      score,
      lives,
    });

    setSeenWords(result.nextSeenWords);
    setScore(result.nextScore);
    setLives(result.nextLives);

    actions.recordTrial({
      difficulty_level: result.nextSeenWords.length,
      reaction_ms: reactionMs,
      correct: result.isCorrect,
      score_before: score,
      score_after: result.nextScore,
      lives_before: lives,
      lives_after: result.nextLives,
      event_payload: {
        word: currentWord,
        truth_seen: result.actualSeen,
        answer_seen: guessSeen,
        error_type: result.errorType,
        unique_words_seen: result.uniqueWordsSeen,
      },
    });

    if (result.nextLives <= 0) {
      setPhase("gameover");
      setStatusText(`Game over. Final score: ${result.nextScore}.`);
      await actions.finishTrackedRun({
        finalScore: result.nextScore,
        finalLives: 0,
      });
      return;
    }

    const nextWord = pickNextWord(result.nextSeenWords);
    wordShownAtRef.current = Date.now();
    setCurrentWord(nextWord);
    if (result.isCorrect) {
      setStatusText("Correct. Keep going.");
    } else {
      setStatusText(`Wrong. ${result.nextLives} ${result.nextLives === 1 ? "life" : "lives"} remaining.`);
    }
  }

  return (
    <GameShell
      title={state.definition.heroTitle}
      subtitle={state.definition.subtitle}
      hudItems={[
        { label: "Score", value: `${score}` },
        { label: "Lives", value: `${lives}` },
        { label: "Unique Words", value: `${seenCount}` },
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
              ? "Mark each word correctly to build your streak."
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Game
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="center-stack verbal-stage">
          <p className="muted">Current Word</p>
          <div className="verbal-word">{currentWord}</div>
          <div className="verbal-actions">
            <button
              className="btn ghost"
              type="button"
              disabled={phase !== "playing"}
              onClick={() => {
                void handleGuess(true);
              }}
            >
              Seen
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={phase !== "playing"}
              onClick={() => {
                void handleGuess(false);
              }}
            >
              New
            </button>
          </div>
        </div>
      )}

      {phase === "gameover" && (
        <div className="center-stack">
          <p className="muted">{state.isSavingResult ? "Saving score..." : "Score recorded."}</p>
          <button className="btn" type="button" onClick={() => void startGame()}>
            Play Again
          </button>
        </div>
      )}
    </GameShell>
  );
}
