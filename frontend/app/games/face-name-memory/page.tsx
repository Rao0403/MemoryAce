"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";

import { GameShell } from "@/components/GameShell";
import {
  createFaceNameRound,
  DEFAULT_FACE_NAME_COUNT,
  evaluateFaceNameRound,
  FACE_NAME_MAX_COUNT,
  type FaceNameAnswerResult,
  type FaceNameRound,
} from "@/lib/game-logic/faceNameMemory";
import { useGameSession } from "@/lib/useGameSession";

type Phase = "idle" | "memorize" | "recall" | "results";

const GAME_KEY = "face_name_memory" as const;

export default function FaceNameMemoryPage() {
  const { state, actions } = useGameSession(GAME_KEY);
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedCount, setSelectedCount] = useState(DEFAULT_FACE_NAME_COUNT);
  const [round, setRound] = useState<FaceNameRound | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<FaceNameAnswerResult[]>([]);
  const [statusText, setStatusText] = useState(
    "Choose how many people to study, memorize the names, then type every name from memory.",
  );

  const recallStartedAtRef = useRef<number | null>(null);

  const totalCorrect = useMemo(
    () => results.filter((result) => result.isCorrect).length,
    [results],
  );

  async function startGame() {
    const started = await actions.startTrackedRun();
    if (!started) {
      return;
    }

    const nextRound = createFaceNameRound(selectedCount);
    setRound(nextRound);
    setAnswers({});
    setResults([]);
    setPhase("memorize");
    recallStartedAtRef.current = null;
    setStatusText(`Study ${selectedCount} face-name pairs, then click Start Guessing.`);
  }

  function startRecall() {
    if (!round) {
      return;
    }

    setAnswers(
      Object.fromEntries(round.prompts.map((prompt) => [prompt.face.id, ""])) as Record<string, string>,
    );
    setPhase("recall");
    recallStartedAtRef.current = Date.now();
    setStatusText("Type every first name exactly as you remember it, then submit the full grid.");
  }

  async function submitRecall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!round) {
      return;
    }

    const evaluation = evaluateFaceNameRound(round, answers);
    const reactionMs = recallStartedAtRef.current ? Date.now() - recallStartedAtRef.current : null;
    let scoreSoFar = 0;

    for (const result of evaluation.results) {
      const scoreBefore = scoreSoFar;
      if (result.isCorrect) {
        scoreSoFar += 1;
      }

      actions.recordTrial({
        event_name: "name_recalled",
        difficulty_level: round.faceCount,
        reaction_ms: reactionMs,
        correct: result.isCorrect,
        score_before: scoreBefore,
        score_after: scoreSoFar,
        event_payload: {
          face_id: result.faceId,
          face_gender: result.faceGender,
          assigned_name: result.assignedName,
          typed_name: result.typedName,
          selected_face_count: round.faceCount,
          recall_index: result.recallIndex,
          is_correct: result.isCorrect,
        },
      });
    }

    setResults(evaluation.results);
    setPhase("results");
    setStatusText(`You recalled ${evaluation.totalCorrect} of ${round.faceCount} names correctly.`);
    await actions.finishTrackedRun({
      finalScore: evaluation.totalCorrect,
      totalTrials: round.faceCount,
    });
  }

  function updateAnswer(faceId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [faceId]: value,
    }));
  }

  function renderFaceCard(params: {
    face: FaceNameRound["prompts"][number]["face"];
    assignedName?: string;
    answer?: string;
    result?: FaceNameAnswerResult;
    showInput?: boolean;
  }) {
    return (
      <article className={`face-card ${params.result ? (params.result.isCorrect ? "is-correct" : "is-incorrect") : ""}`}>
        <div className="face-portrait-wrap">
          <Image
            src={params.face.imagePath}
            alt={`${params.face.gender} portrait`}
            width={160}
            height={180}
            className="face-portrait"
            unoptimized
          />
        </div>

        {params.assignedName && <p className="face-assigned-name">{params.assignedName}</p>}

        {params.showInput && (
          <input
            className="text-input face-name-input"
            value={params.answer ?? ""}
            onChange={(inputEvent) => updateAnswer(params.face.id, inputEvent.target.value)}
            placeholder="Type first name"
            maxLength={32}
          />
        )}

        {params.result && (
          <div className="face-result-block">
            <p className={`face-result-label ${params.result.isCorrect ? "is-correct" : "is-incorrect"}`}>
              {params.result.isCorrect ? "Correct" : "Missed"}
            </p>
            {!params.result.isCorrect && <p className="face-correct-name">Correct: {params.result.assignedName}</p>}
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
        { label: "Faces", value: `${round?.faceCount ?? selectedCount}` },
        { label: "Phase", value: phase === "idle" ? "Setup" : phase === "memorize" ? "Study" : phase === "recall" ? "Recall" : "Results" },
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
        <div className="face-name-setup">
          <div className="panel compact face-count-panel">
            <p className="panel-title">Face Count</p>
            <strong className="face-count-value">{selectedCount}</strong>
            <input
              type="range"
              min={1}
              max={FACE_NAME_MAX_COUNT}
              value={selectedCount}
              onChange={(event) => setSelectedCount(Number(event.target.value))}
              className="face-count-slider"
            />
            <p className="muted">Pick between 1 and 30 faces. Score equals the number of correct names.</p>
          </div>

          <div className="center-stack face-name-start">
            <h2>Ready?</h2>
            <p className="muted">
              {state.hasPlayerName
                ? "Study the names, then recall every first name from memory on one full grid."
                : "Save a player name above to start a tracked run."}
            </p>
            <button className="btn" type="button" onClick={() => void startGame()} disabled={!state.hasPlayerName}>
              Start Face + Name Memory
            </button>
          </div>
        </div>
      )}

      {phase === "memorize" && round && (
        <div className="face-name-stage">
          <div className="face-grid">
            {round.prompts.map((prompt) => (
              <div key={prompt.face.id}>
                {renderFaceCard({
                  face: prompt.face,
                  assignedName: prompt.assignedName,
                })}
              </div>
            ))}
          </div>
          <button className="btn secondary" type="button" onClick={startRecall}>
            Start Guessing
          </button>
        </div>
      )}

      {phase === "recall" && round && (
        <form className="face-name-stage" onSubmit={(formEvent) => void submitRecall(formEvent)}>
          <div className="face-grid">
            {round.prompts.map((prompt) => (
              <div key={prompt.face.id}>
                {renderFaceCard({
                  face: prompt.face,
                  answer: answers[prompt.face.id] ?? "",
                  showInput: true,
                })}
              </div>
            ))}
          </div>
          <button className="btn" type="submit">
            Submit All Names
          </button>
        </form>
      )}

      {phase === "results" && round && (
        <div className="face-name-stage">
          <div className="face-grid">
            {round.prompts.map((prompt) => (
              <div key={prompt.face.id}>
                {renderFaceCard({
                  face: prompt.face,
                  answer: answers[prompt.face.id] ?? "",
                  result: results.find((result) => result.faceId === prompt.face.id),
                })}
              </div>
            ))}
          </div>
          <div className="center-stack face-name-endcap">
            <p className="muted">{state.isSavingResult ? "Saving score..." : `You got ${totalCorrect} out of ${round.faceCount}.`}</p>
            <button className="btn" type="button" onClick={() => void startGame()}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </GameShell>
  );
}
