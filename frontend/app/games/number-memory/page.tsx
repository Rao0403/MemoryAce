"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { GameHeader } from "@/components/GameHeader";
import { getStoredPlayerName } from "@/components/PlayerNameInput";
import { Leaderboard, PersonalStats } from "@/components/Scoreboards";
import { fetchLeaderboard, fetchStats, submitScore, type LeaderboardRow, type PlayerGameStats } from "@/lib/api";

type Phase = "idle" | "showing" | "input" | "gameover";

const GAME_KEY = "number_memory" as const;

function generateNumber(level: number): string {
  let value = "";
  for (let index = 0; index < level; index += 1) {
    const min = index === 0 ? 1 : 0;
    value += Math.floor(Math.random() * (10 - min) + min).toString();
  }
  return value;
}

export default function NumberMemoryPage() {
  const [playerName, setPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [shownNumber, setShownNumber] = useState("");
  const [answer, setAnswer] = useState("");
  const [statusText, setStatusText] = useState("Start at 1 digit and climb forever.");
  const [isSaving, setIsSaving] = useState(false);

  const [stats, setStats] = useState<PlayerGameStats | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealMs = useMemo(() => Math.min(4500, 1000 + level * 260), [level]);

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
    setLevel(nextLevel);
    setShownNumber(generated);
    setAnswer("");
    setPhase("showing");
    setStatusText(`Level ${nextLevel}: memorize quickly.`);

    timeoutRef.current = setTimeout(() => {
      setPhase("input");
      setStatusText(`Type the ${nextLevel}-digit number.`);
    }, Math.min(6000, 1000 + nextLevel * 260));
  }

  function startGame() {
    runLevel(1);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = answer.trim();
    if (!normalized) {
      setStatusText("Type your answer before submitting.");
      return;
    }

    if (normalized === shownNumber) {
      const next = level + 1;
      setStatusText(`Correct. Next: ${next} digits.`);
      runLevel(next);
      return;
    }

    const score = Math.max(0, level - 1);
    setPhase("gameover");
    setStatusText(`Wrong. Number was ${shownNumber}. Final score: ${score}.`);
    await persistScore(score);
  }

  return (
    <main className="page-wrap game-page">
      <GameHeader title="Number Memory" subtitle="Each round adds one digit. Beat your limit." />

      <section className="game-grid">
        <article className="panel game-surface">
          <div className="hud-row">
            <span className="chip">Level {level}</span>
            <span className="chip">Reveal {revealMs}ms</span>
            {playerName ? <span className="chip">{playerName}</span> : <span className="chip warning">No player name</span>}
          </div>

          {phase === "idle" && (
            <div className="center-stack">
              <h2>Ready?</h2>
              <p className="muted">Memorize what you see before it fades.</p>
              <button className="btn" type="button" onClick={startGame}>
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
            <form onSubmit={handleSubmit} className="center-stack">
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
              <p className="muted">{isSaving ? "Saving score..." : "Score recorded."}</p>
              <button className="btn" type="button" onClick={startGame}>
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