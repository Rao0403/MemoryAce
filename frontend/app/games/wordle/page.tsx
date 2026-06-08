"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import {
  buildWordleKeyboardState,
  evaluateWordleGuess,
  isValidWordleGuess,
  isWordleLetterKey,
  normalizeWordleGuess,
  pickRandomWordleSolution,
  WORDLE_KEYBOARD_ROWS,
  WORDLE_MAX_GUESSES,
  WORDLE_WORD_LENGTH,
  type WordleGuessResult,
} from "@/lib/game-logic/wordle";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "playing" | "won" | "lost";

const GAME_KEY = "wordle" as const;

function buildBoardRows(guesses: WordleGuessResult[], currentGuess: string): Array<Array<{ letter: string; state?: string }>> {
  return Array.from({ length: WORDLE_MAX_GUESSES }, (_, rowIndex) => {
    const submitted = guesses[rowIndex];
    if (submitted) {
      return submitted.tiles.map((tile) => ({ letter: tile.letter.toUpperCase(), state: tile.state }));
    }

    if (rowIndex === guesses.length) {
      return Array.from({ length: WORDLE_WORD_LENGTH }, (_, colIndex) => ({
        letter: currentGuess[colIndex]?.toUpperCase() ?? "",
        state: currentGuess[colIndex] ? "active" : "empty",
      }));
    }

    return Array.from({ length: WORDLE_WORD_LENGTH }, () => ({ letter: "", state: "empty" }));
  });
}

export default function WordlePage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [currentGuess, setCurrentGuess] = useState("");
  const [guesses, setGuesses] = useState<WordleGuessResult[]>([]);
  const [statusText, setStatusText] = useState("Break the word in six guesses using color clues.");

  const guessStartedAtRef = useRef<number | null>(null);
  const submitGuessRef = useRef<() => Promise<void>>(async () => {});
  const handleBackspaceRef = useRef<() => void>(() => {});
  const handleLetterInputRef = useRef<(letter: string) => void>(() => {});
  const keyboardState = useMemo(() => buildWordleKeyboardState(guesses), [guesses]);
  const boardRows = useMemo(() => buildBoardRows(guesses, currentGuess), [currentGuess, guesses]);

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    setAnswer(pickRandomWordleSolution());
    setCurrentGuess("");
    setGuesses([]);
    setPhase("playing");
    guessStartedAtRef.current = Date.now();
    setStatusText("Round started. Type a five-letter word and press Enter.");
  }

  function handleLetterInput(letter: string) {
    if (phase !== "playing" || currentGuess.length >= WORDLE_WORD_LENGTH) {
      return;
    }

    setCurrentGuess((previous) => `${previous}${letter.toLowerCase()}`);
  }

  function handleBackspace() {
    if (phase !== "playing") {
      return;
    }

    setCurrentGuess((previous) => previous.slice(0, -1));
  }

  async function submitGuess() {
    if (phase !== "playing" || !answer) {
      return;
    }

    const normalizedGuess = normalizeWordleGuess(currentGuess);
    if (normalizedGuess.length !== WORDLE_WORD_LENGTH) {
      setStatusText("Enter a full five-letter word.");
      return;
    }

    if (!isValidWordleGuess(normalizedGuess)) {
      setStatusText("That word is not in the local dictionary.");
      return;
    }

    const reactionMs = guessStartedAtRef.current ? Date.now() - guessStartedAtRef.current : null;
    const result = evaluateWordleGuess(answer, normalizedGuess);
    const nextGuesses = [...guesses, result];
    const nextKeyboard = buildWordleKeyboardState(nextGuesses);
    const guessIndex = nextGuesses.length;

    setGuesses(nextGuesses);
    setCurrentGuess("");

    actions.recordTrial({
      event_name: "guess_submitted",
      difficulty_level: WORDLE_WORD_LENGTH,
      reaction_ms: reactionMs,
      correct: result.isWin,
      score_before: 0,
      score_after: result.isWin ? 1 : 0,
      event_payload: {
        guess: result.guess,
        guess_index: guessIndex,
        answer_length: WORDLE_WORD_LENGTH,
        is_win: result.isWin,
        is_valid_guess: true,
        letter_results: result.tiles.map((tile) => tile.state),
        keyboard_snapshot: nextKeyboard,
      },
    });

    if (result.isWin) {
      setPhase("won");
      setStatusText(`Solved in ${guessIndex}/${WORDLE_MAX_GUESSES}.`);
      await actions.finishTrackedRun({ finalScore: 1, totalTrials: guessIndex });
      return;
    }

    if (guessIndex >= WORDLE_MAX_GUESSES) {
      setPhase("lost");
      setStatusText(`No guesses left. The word was ${answer.toUpperCase()}.`);
      await actions.finishTrackedRun({ finalScore: 0, totalTrials: guessIndex });
      return;
    }

    guessStartedAtRef.current = Date.now();
    setStatusText(`${WORDLE_MAX_GUESSES - guessIndex} guesses remaining.`);
  }

  function handleVirtualKey(key: string) {
    if (key === "ENTER") {
      void submitGuess();
      return;
    }

    if (key === "BACKSPACE") {
      handleBackspace();
      return;
    }

    handleLetterInput(key);
  }

  submitGuessRef.current = submitGuess;
  handleBackspaceRef.current = handleBackspace;
  handleLetterInputRef.current = handleLetterInput;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (phase !== "playing") {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void submitGuessRef.current();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        handleBackspaceRef.current();
        return;
      }

      if (isWordleLetterKey(event.key)) {
        event.preventDefault();
        handleLetterInputRef.current(event.key);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase]);

  return (
    <GameShell
      title={state.definition.heroTitle}
      subtitle={state.definition.subtitle}
      hudItems={[
        { label: "Guesses", value: `${guesses.length}/${WORDLE_MAX_GUESSES}` },
        { label: "Score", value: phase === "won" ? "1" : "0" },
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
              ? "Find the hidden five-letter word in six guesses."
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Wordle
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="wordle-stage">
          <div className="wordle-board" aria-label="Wordle board">
            {boardRows.map((row, rowIndex) => (
              <div className="wordle-row" key={`row-${rowIndex}`}>
                {row.map((tile, colIndex) => (
                  <div
                    className={`wordle-tile ${tile.state ? `is-${tile.state}` : ""}`}
                    key={`tile-${rowIndex}-${colIndex}`}
                  >
                    {tile.letter}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="wordle-keyboard" aria-label="Wordle keyboard">
            {WORDLE_KEYBOARD_ROWS.map((row, rowIndex) => (
              <div className="wordle-keyboard-row" key={`keyboard-row-${rowIndex}`}>
                {row.map((key) => {
                  const keyState = keyboardState[key];
                  const label = key === "BACKSPACE" ? "⌫" : key;
                  return (
                    <button
                      className={`wordle-key ${key.length > 1 ? "wide" : ""} ${keyState ? `is-${keyState}` : ""}`}
                      type="button"
                      key={key}
                      onClick={() => handleVirtualKey(key)}
                      disabled={phase === "won" || phase === "lost"}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {(phase === "won" || phase === "lost") && (
            <div className="center-stack wordle-endcap">
              <p className="muted">{state.isSavingResult ? "Saving score..." : "Score recorded."}</p>
              <button className="btn" type="button" onClick={() => void startGame()}>
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </GameShell>
  );
}
