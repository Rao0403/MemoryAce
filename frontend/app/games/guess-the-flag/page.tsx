"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import {
  computeFlagSpeedScore,
  createFlagRound,
  evaluateFlagAnswer,
  FLAG_COUNTRY_COUNT,
  type FlagAnswerResult,
  type FlagRoundEntry,
} from "@/lib/game-logic/guessTheFlag";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "playing" | "results";

const GAME_KEY = "guess_the_flag" as const;

export default function GuessTheFlagPage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<FlagRoundEntry[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedResults, setSubmittedResults] = useState<Record<string, FlagAnswerResult>>({});
  const [results, setResults] = useState<FlagAnswerResult[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsedSeconds, setFinalElapsedSeconds] = useState(0);
  const [finalSpeedScore, setFinalSpeedScore] = useState(0);
  const [statusText, setStatusText] = useState(
    "Submit each flag with Enter, and use Give Up whenever you want the rest revealed.",
  );

  const roundStartedAtRef = useRef<number | null>(null);
  const submittedResultsRef = useRef<Record<string, FlagAnswerResult>>({});
  const correctCountRef = useRef(0);

  const totalCorrect = useMemo(() => results.filter((result) => result.isCorrect).length, [results]);
  const resultByCountryId = useMemo(
    () => Object.fromEntries(results.map((result) => [result.countryId, result])),
    [results],
  );
  const filledCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers],
  );
  const submittedCount = useMemo(() => Object.keys(submittedResults).length, [submittedResults]);
  const liveCorrectCount = useMemo(
    () => Object.values(submittedResults).filter((result) => result.isCorrect).length,
    [submittedResults],
  );

  useEffect(() => {
    if (phase !== "playing" || !roundStartedAtRef.current) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!roundStartedAtRef.current) {
        return;
      }
      setElapsedSeconds(Math.max(1, Math.round((Date.now() - roundStartedAtRef.current) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase]);

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    submittedResultsRef.current = {};
    correctCountRef.current = 0;
    setRound(createFlagRound());
    setAnswers({});
    setSubmittedResults({});
    setResults([]);
    setElapsedSeconds(0);
    setFinalElapsedSeconds(0);
    setFinalSpeedScore(0);
    setPhase("playing");
    roundStartedAtRef.current = Date.now();
    setStatusText(`Round started. Press Enter on any card to lock it in, or give up to reveal the rest.`);
  }

  function updateAnswer(countryId: string, value: string) {
    if (submittedResultsRef.current[countryId]) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [countryId]: value,
    }));
  }

  async function finalizeRound(endReason: "completed" | "quit") {
    if (phase !== "playing" || round.length === 0) {
      return;
    }

    const evaluation = {
      totalCountries: round.length,
      results: round.map((entry) => {
        const submitted = submittedResultsRef.current[entry.country.id];
        if (submitted) {
          return submitted;
        }
        return evaluateFlagAnswer(entry, endReason === "quit" ? "" : answers[entry.country.id] ?? "");
      }),
    };
    const totalCorrectCount = evaluation.results.filter((result) => result.isCorrect).length;
    const elapsedMs = roundStartedAtRef.current ? Date.now() - roundStartedAtRef.current : 0;
    let scoreSoFar = correctCountRef.current;

    for (const result of evaluation.results) {
      if (submittedResultsRef.current[result.countryId]) {
        continue;
      }

      actions.recordTrial({
        event_name: endReason === "quit" ? "flag_skipped" : "flag_guessed",
        difficulty_level: evaluation.totalCountries,
        reaction_ms: elapsedMs,
        correct: endReason === "quit" ? false : result.isCorrect,
        score_before: scoreSoFar,
        score_after: scoreSoFar + (endReason === "quit" ? 0 : result.isCorrect ? 1 : 0),
        event_payload: {
          country_id: result.countryId,
          alpha2_code: result.alpha2Code,
          display_name: result.displayName,
          typed_answer: result.typedAnswer,
          normalized_answer: result.normalizedAnswer,
          is_correct: endReason === "quit" ? false : result.isCorrect,
          accepted_via_alias: endReason === "quit" ? false : result.acceptedViaAlias,
          recall_index: result.recallIndex,
          total_countries: evaluation.totalCountries,
        },
      });

      if (endReason !== "quit" && result.isCorrect) {
        scoreSoFar += 1;
      }
    }

    const { elapsedSeconds: totalElapsedSeconds, speedScore } = computeFlagSpeedScore(
      totalCorrectCount,
      elapsedMs,
    );
    setResults(evaluation.results);
    setFinalElapsedSeconds(totalElapsedSeconds);
    setFinalSpeedScore(speedScore);
    setPhase("results");
    setStatusText(
      endReason === "quit"
        ? `You gave up with ${totalCorrectCount} correct. Leaderboard score: ${speedScore}.`
        : `You identified ${totalCorrectCount} of ${evaluation.totalCountries} flags. Leaderboard score: ${speedScore}.`,
    );
    await actions.finishTrackedRun({
      finalScore: speedScore,
      totalTrials: evaluation.totalCountries,
      endReason,
    });
  }

  async function submitSingleAnswer(countryId: string) {
    if (phase !== "playing") {
      return;
    }

    const entry = round.find((item) => item.country.id === countryId);
    if (!entry || submittedResultsRef.current[countryId]) {
      return;
    }

    const typedAnswer = answers[countryId] ?? "";
    if (!typedAnswer.trim()) {
      setStatusText("Type an answer before submitting that flag.");
      return;
    }

    const result = evaluateFlagAnswer(entry, typedAnswer);
    const elapsedMs = roundStartedAtRef.current ? Date.now() - roundStartedAtRef.current : null;
    const scoreBefore = correctCountRef.current;
    const scoreAfter = scoreBefore + (result.isCorrect ? 1 : 0);

    actions.recordTrial({
      event_name: "flag_guessed",
      difficulty_level: round.length,
      reaction_ms: elapsedMs,
      correct: result.isCorrect,
      score_before: scoreBefore,
      score_after: scoreAfter,
      event_payload: {
        country_id: result.countryId,
        alpha2_code: result.alpha2Code,
        display_name: result.displayName,
        typed_answer: result.typedAnswer,
        normalized_answer: result.normalizedAnswer,
        is_correct: result.isCorrect,
        accepted_via_alias: result.acceptedViaAlias,
        recall_index: result.recallIndex,
        total_countries: round.length,
      },
    });

    if (result.isCorrect) {
      correctCountRef.current = scoreAfter;
    }

    submittedResultsRef.current = {
      ...submittedResultsRef.current,
      [countryId]: result,
    };
    setSubmittedResults(submittedResultsRef.current);
    setStatusText(
      result.isCorrect
        ? `${result.displayName} locked in as correct.`
        : `${result.typedAnswer.trim()} is not correct for ${result.displayName}.`,
    );

    if (Object.keys(submittedResultsRef.current).length === round.length) {
      await finalizeRound("completed");
    }
  }

  async function handleGiveUp() {
    await finalizeRound("quit");
  }

  function renderFlagCard(entry: FlagRoundEntry) {
    const result = phase === "results" ? resultByCountryId[entry.country.id] : submittedResults[entry.country.id];
    const isLocked = Boolean(result);

    return (
      <article className={`flag-card ${result ? (result.isCorrect ? "is-correct" : "is-incorrect") : ""}`}>
        <div className="flag-image-wrap">
          <Image
            src={entry.country.assetPath}
            alt={`Flag of ${entry.country.displayName}`}
            width={160}
            height={120}
            className="flag-image"
            unoptimized
          />
        </div>

        {phase === "playing" ? (
          <div className="flag-input-stack">
            <input
              className="text-input flag-entry-input"
              name={entry.country.id}
              placeholder="Type country"
              maxLength={80}
              value={answers[entry.country.id] ?? ""}
              onChange={(inputEvent) => updateAnswer(entry.country.id, inputEvent.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitSingleAnswer(entry.country.id);
                }
              }}
              disabled={isLocked}
            />
            <button
              className="btn secondary flag-submit-button"
              type="button"
              onClick={() => void submitSingleAnswer(entry.country.id)}
              disabled={isLocked}
            >
              {isLocked ? "Locked" : "Submit"}
            </button>
            {result && (
              <p className={`flag-inline-feedback ${result.isCorrect ? "is-correct" : "is-incorrect"}`}>
                {result.isCorrect ? "Correct" : `Correct: ${result.displayName}`}
              </p>
            )}
          </div>
        ) : (
          <div className="flag-result-block">
            <p className={`flag-result-label ${result?.isCorrect ? "is-correct" : "is-incorrect"}`}>
              {result?.isCorrect ? "Correct" : "Missed"}
            </p>
            {result && (
              <>
                <p className="flag-answer-preview">You typed: {result.typedAnswer.trim() || "Blank"}</p>
                {!result.isCorrect && <p className="flag-correct-answer">Correct: {result.displayName}</p>}
              </>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <GameShell
      title={state.definition.heroTitle}
      subtitle={state.definition.subtitle}
      hudItems={[
        { label: "Flags", value: `${FLAG_COUNTRY_COUNT}` },
        { label: "Phase", value: phase === "idle" ? "Setup" : phase === "playing" ? "Guessing" : "Results" },
        { label: "Submitted", value: `${phase === "results" ? FLAG_COUNTRY_COUNT : submittedCount}/${FLAG_COUNTRY_COUNT}` },
        { label: "Correct", value: `${phase === "results" ? totalCorrect : liveCorrectCount}` },
        { label: "Time", value: `${phase === "results" ? finalElapsedSeconds : elapsedSeconds}s` },
        { label: "Speed", value: `${phase === "results" ? finalSpeedScore : 0}` },
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
              ? `This run uses all ${FLAG_COUNTRY_COUNT} sovereign-country flags. Press Enter to submit one flag at a time, and the leaderboard score uses correct answers per second.`
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Guess the Flag
          </button>
        </div>
      )}

      {phase === "playing" && (
        <div className="flag-stage">
          <div className="flag-toolbar">
            <div className="flag-toolbar-stats">
              <span className="chip">Filled {filledCount}</span>
              <span className="chip">Locked {submittedCount}</span>
              <span className="chip">Remaining {FLAG_COUNTRY_COUNT - submittedCount}</span>
            </div>
            <div className="flag-toolbar-actions">
              <button className="btn ghost" type="button" onClick={() => void handleGiveUp()}>
                Give Up
              </button>
            </div>
          </div>

          <div className="flag-grid">
            {round.map((entry) => (
              <div key={entry.country.id}>{renderFlagCard(entry)}</div>
            ))}
          </div>
        </div>
      )}

      {phase === "results" && (
        <div className="flag-stage">
          <div className="flag-toolbar is-results">
            <div className="flag-toolbar-stats">
              <span className="chip">Correct {totalCorrect}</span>
              <span className="chip">Missed {FLAG_COUNTRY_COUNT - totalCorrect}</span>
              <span className="chip">Time {finalElapsedSeconds}s</span>
              <span className="chip">Leaderboard {finalSpeedScore}</span>
              <span className="chip">{state.isSavingResult ? "Saving score..." : "Score recorded"}</span>
            </div>
            <button className="btn" type="button" onClick={() => void startGame()}>
              Play Again
            </button>
          </div>

          <div className="flag-grid">
            {round.map((entry) => (
              <div key={entry.country.id}>{renderFlagCard(entry)}</div>
            ))}
          </div>
        </div>
      )}
    </GameShell>
  );
}
