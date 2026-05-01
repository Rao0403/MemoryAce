"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { GameHeader } from "@/components/GameHeader";
import { getStoredPlayerName, setStoredPlayerName } from "@/components/PlayerNameInput";
import { fetchDashboard, type PlayerDashboardStats } from "@/lib/api";
import { GAME_LABELS, type GameKey } from "@/lib/constants";

const GAME_ROUTES: Record<GameKey, string> = {
  number_memory: "/games/number-memory",
  sequence_memory: "/games/sequence-memory",
  verbal_memory: "/games/verbal-memory",
};

export default function DashboardPage() {
  const [playerName, setPlayerName] = useState("");
  const [queryName, setQueryName] = useState("");
  const [stats, setStats] = useState<PlayerDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const stored = getStoredPlayerName();
    if (!stored) return;
    setPlayerName(stored);
    setQueryName(stored);
  }, []);

  useEffect(() => {
    if (!queryName.trim()) {
      setStats(null);
      return;
    }
    void loadDashboard(queryName);
  }, [queryName]);

  const bestGame = useMemo(() => {
    if (!stats) return null;
    const nonZero = stats.games.filter((game) => game.attempts > 0);
    if (nonZero.length === 0) return null;
    return nonZero.reduce((best, current) => (current.high_score > best.high_score ? current : best));
  }, [stats]);

  async function loadDashboard(name: string) {
    setLoading(true);
    setErrorText("");
    try {
      const data = await fetchDashboard(name.trim());
      setStats(data);
    } catch {
      setStats(null);
      setErrorText("Could not load dashboard right now.");
    } finally {
      setLoading(false);
    }
  }

  function saveAndLoad() {
    const normalized = playerName.trim();
    if (!normalized) return;
    setStoredPlayerName(normalized);
    setPlayerName(normalized);
    setQueryName(normalized);
  }

  return (
    <main className="page-wrap dashboard-page">
      <GameHeader title="Player Dashboard" subtitle="Track your performance across all games." />

      <section className="panel dashboard-shell">
        <div className="input-row dashboard-input-row">
          <input
            className="text-input"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            maxLength={64}
            placeholder="Enter your player name"
          />
          <button className="btn" onClick={saveAndLoad} type="button">
            Load Stats
          </button>
        </div>

        {loading && <p className="muted">Loading dashboard...</p>}
        {errorText && <p className="error-text">{errorText}</p>}

        {stats && (
          <>
            <div className="dashboard-top-grid">
              <article className="panel compact stat-card">
                <p className="panel-title">Player</p>
                <strong>{stats.player_name}</strong>
              </article>
              <article className="panel compact stat-card">
                <p className="panel-title">Total Attempts</p>
                <strong>{stats.total_attempts}</strong>
              </article>
              <article className="panel compact stat-card">
                <p className="panel-title">Games Played</p>
                <strong>{stats.games_played}</strong>
              </article>
              <article className="panel compact stat-card">
                <p className="panel-title">Best Game</p>
                <strong>{bestGame ? GAME_LABELS[bestGame.game] : "No data yet"}</strong>
              </article>
            </div>

            <div className="dashboard-games-grid">
              {stats.games.map((gameStats) => (
                <article className="panel compact game-stat-card" key={gameStats.game}>
                  <h2>{GAME_LABELS[gameStats.game]}</h2>
                  <div className="stats-grid">
                    <div>
                      <span className="label">High Score</span>
                      <strong>{gameStats.high_score}</strong>
                    </div>
                    <div>
                      <span className="label">Average</span>
                      <strong>{gameStats.average_score.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="label">Attempts</span>
                      <strong>{gameStats.attempts}</strong>
                    </div>
                  </div>
                  <Link className="btn secondary" href={GAME_ROUTES[gameStats.game]}>
                    Play {GAME_LABELS[gameStats.game]}
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
