"use client";

import { useEffect, useRef, useState } from "react";

import { GameHeader } from "@/components/GameHeader";
import { getStoredPlayerName } from "@/components/PlayerNameInput";
import { Leaderboard, PersonalStats } from "@/components/Scoreboards";
import { fetchLeaderboard, fetchStats, submitScore, type LeaderboardRow, type PlayerGameStats } from "@/lib/api";

type Phase = "idle" | "playback" | "input" | "gameover";

const GRID_SIZE = 9;
const GAME_KEY = "sequence_memory" as const;

function randomCell(): number {
  return Math.floor(Math.random() * GRID_SIZE);
}

export default function SequenceMemoryPage() {
  const [playerName, setPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("Watch the sequence, then repeat it exactly.");
  const [isSaving, setIsSaving] = useState(false);

  const [stats, setStats] = useState<PlayerGameStats | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);

  const timerRefs = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const name = getStoredPlayerName();
    setPlayerName(name);
  }, []);

  useEffect(() => {
    if (!playerName) return;

    let cancelled = false;
    Promise.all([fetchStats({ playerName, game: GAME_KEY }), fetchLeaderboard(GAME_KEY)])
      .then(([personal, leaderboard]) => {
        if (cancelled) return;
        setStats(personal);
        setLeaderboardRows(leaderboard);
      })
      .catch(() => {
        if (cancelled) return;
        setStatusText("Could not load score history right now.");
      });

    return () => {
      cancelled = true;
    };
  }, [playerName]);

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
        setPhase("input");
        setStatusText("Your turn. Repeat the full pattern.");
      }, inputStart),
    );
  }

  function startGame() {
    const first = [randomCell()];
    setSequence(first);
    setStatusText("Level 1 sequence incoming.");
    playSequence(first);
  }

  async function persistScore(score: number) {
    if (!playerName) {
      setStatusText("Set a player name on Home before saving scores.");
      return;
    }

    setIsSaving(true);
    try {
      const personal = await submitScore({ playerName, game: GAME_KEY, score });
      const leaderboard = await fetchLeaderboard(GAME_KEY);
      setStats(personal);
      setLeaderboardRows(leaderboard);
    } catch {
      setStatusText("Run ended, but score save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onCellClick(cell: number) {
    if (phase !== "input") return;

    setActiveCell(cell);
    const offTimer = setTimeout(() => setActiveCell(null), 120);
    timerRefs.current.push(offTimer);

    const expected = sequence[playerStep];
    if (cell !== expected) {
      const score = Math.max(0, sequence.length - 1);
      setPhase("gameover");
      setStatusText(`Wrong tap. Final score: ${score}.`);
      await persistScore(score);
      return;
    }

    const nextStep = playerStep + 1;
    if (nextStep < sequence.length) {
      setPlayerStep(nextStep);
      return;
    }

    const extended = [...sequence, randomCell()];
    setSequence(extended);
    setStatusText(`Correct. Level ${extended.length} incoming.`);
    playSequence(extended);
  }

  return (
    <main className="page-wrap game-page">
      <GameHeader title="Sequence Memory" subtitle="3x3 pattern chains. Repeat perfectly." />

      <section className="game-grid">
        <article className="panel game-surface">
          <div className="hud-row">
            <span className="chip">Level {Math.max(1, sequence.length)}</span>
            <span className="chip">Step {Math.min(playerStep + 1, Math.max(sequence.length, 1))}</span>
            {playerName ? <span className="chip">{playerName}</span> : <span className="chip warning">No player name</span>}
          </div>

          {phase === "idle" && (
            <div className="center-stack">
              <h2>Ready?</h2>
              <p className="muted">Memorize each glow and replay in exact order.</p>
              <button className="btn" type="button" onClick={startGame}>
                Start Game
              </button>
            </div>
          )}

          {phase !== "idle" && (
            <div className="sequence-grid" aria-label="3 by 3 sequence grid">
              {Array.from({ length: GRID_SIZE }).map((_, cell) => (
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
              <p className="muted">{isSaving ? "Saving score..." : "Score recorded."}</p>
              <button className="btn secondary" type="button" onClick={startGame}>
                Play Again
              </button>
            </div>
          )}

          <p className="status-line">{statusText}</p>
        </article>

        <aside className="side-panel">
          <article className="panel compact">
            <p className="panel-title">Your Stats</p>
            <PersonalStats stats={stats} />
          </article>
          <article className="panel compact">
            <p className="panel-title">Top Players</p>
            <Leaderboard rows={leaderboardRows} />
          </article>
        </aside>
      </section>
    </main>
  );
}