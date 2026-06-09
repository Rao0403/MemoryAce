"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import {
  createFlagRound,
  evaluateFlagRound,
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
  const [results, setResults] = useState<FlagAnswerResult[]>([]);
  const [filledCount, setFilledCount] = useState(0);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [statusText, setStatusText] = useState(
    "Work through a full sovereign-country flag grid and submit one complete answer sheet.",
  );

  const answersRef = useRef<Record<string, string>>({});
  const roundStartedAtRef = useRef<number | null>(null);

  const totalCorrect = useMemo(
    () => results.filter((result) => result.isCorrect).length,
    [results],
  );
  const resultByCountryId = useMemo(
    () => Object.fromEntries(results.map((result) => [result.countryId, result])),
    [results],
  );

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    answersRef.current = {};
    setRound(createFlagRound());
    setResults([]);
    setFilledCount(0);
    setSubmittedCount(0);
    setPhase("playing");
    roundStartedAtRef.current = Date.now();
    setStatusText(`Round started. Type all ${FLAG_COUNTRY_COUNT} country names, then submit the full grid.`);
  }

  function updateAnswer(countryId: string, value: string) {
    const previous = answersRef.current[countryId] ?? "";
    answersRef.current[countryId] = value;

    const previouslyFilled = previous.trim().length > 0;
    const currentlyFilled = value.trim().length > 0;

    if (previouslyFilled === currentlyFilled) {
      return;
    }

    setFilledCount((current) => current + (currentlyFilled ? 1 : -1));
  }

  async function submitAnswers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "playing" || round.length === 0) {
      return;
    }

    const evaluation = evaluateFlagRound(round, answersRef.current);
    const reactionMs = roundStartedAtRef.current ? Date.now() - roundStartedAtRef.current : null;
    const answeredCount = Object.values(answersRef.current).filter((value) => value.trim().length > 0).length;
    let scoreSoFar = 0;

    for (const result of evaluation.results) {
      const scoreBefore = scoreSoFar;
      if (result.isCorrect) {
        scoreSoFar += 1;
      }

      actions.recordTrial({
        event_name: "flag_guessed",
        difficulty_level: evaluation.totalCountries,
        reaction_ms: reactionMs,
        correct: result.isCorrect,
        score_before: scoreBefore,
        score_after: scoreSoFar,
        event_payload: {
          country_id: result.countryId,
          alpha2_code: result.alpha2Code,
          display_name: result.displayName,
          typed_answer: result.typedAnswer,
          normalized_answer: result.normalizedAnswer,
          is_correct: result.isCorrect,
          accepted_via_alias: result.acceptedViaAlias,
          recall_index: result.recallIndex,
          total_countries: evaluation.totalCountries,
        },
      });
    }

    setResults(evaluation.results);
    setSubmittedCount(answeredCount);
    setPhase("results");
    setStatusText(`You identified ${evaluation.totalCorrect} of ${evaluation.totalCountries} flags correctly.`);
    await actions.finishTrackedRun({
      finalScore: evaluation.totalCorrect,
      totalTrials: evaluation.totalCountries,
    });
  }

  function renderFlagCard(entry: FlagRoundEntry) {
    const result = resultByCountryId[entry.country.id];
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
          <input
            className="text-input flag-entry-input"
            name={entry.country.id}
            placeholder="Type country"
            maxLength={80}
            onChange={(inputEvent) => updateAnswer(entry.country.id, inputEvent.target.value)}
          />
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
        { label: "Filled", value: `${phase === "playing" ? filledCount : submittedCount}/${FLAG_COUNTRY_COUNT}` },
        { label: "Score", value: `${phase === "results" ? totalCorrect : 0}` },
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
              ? `This run uses all ${FLAG_COUNTRY_COUNT} sovereign-country flags in one randomized grid.`
              : "Save a player name above to start a tracked run."}
          </p>
          <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
            Start Guess the Flag
          </button>
        </div>
      )}

      {phase === "playing" && (
        <form className="flag-stage" onSubmit={(formEvent) => void submitAnswers(formEvent)}>
          <div className="flag-toolbar">
            <div className="flag-toolbar-stats">
              <span className="chip">Filled {filledCount}</span>
              <span className="chip">Remaining {FLAG_COUNTRY_COUNT - filledCount}</span>
              <span className="chip">One full submission</span>
            </div>
            <button className="btn" type="submit">
              Submit All Flags
            </button>
          </div>

          <div className="flag-grid">
            {round.map((entry) => (
              <div key={entry.country.id}>{renderFlagCard(entry)}</div>
            ))}
          </div>
        </form>
      )}

      {phase === "results" && (
        <div className="flag-stage">
          <div className="flag-toolbar is-results">
            <div className="flag-toolbar-stats">
              <span className="chip">Correct {totalCorrect}</span>
              <span className="chip">Missed {FLAG_COUNTRY_COUNT - totalCorrect}</span>
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
