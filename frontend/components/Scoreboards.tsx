import type { LeaderboardRow, PlayerGameStats } from "@/lib/api";

export function PersonalStats({ stats }: { stats: PlayerGameStats | null }) {
  if (!stats) {
    return <p className="muted">No score saved yet for this game.</p>;
  }

  return (
    <div className="stats-grid">
      <div>
        <span className="label">High Score</span>
        <strong>{stats.high_score}</strong>
      </div>
      <div>
        <span className="label">Average</span>
        <strong>{stats.average_score.toFixed(2)}</strong>
      </div>
      <div>
        <span className="label">Attempts</span>
        <strong>{stats.attempts}</strong>
      </div>
    </div>
  );
}

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No leaderboard data yet.</p>;
  }

  return (
    <ol className="leaderboard">
      {rows.map((row) => (
        <li key={row.player_name}>
          <span>{row.player_name}</span>
          <strong>{row.high_score}</strong>
        </li>
      ))}
    </ol>
  );
}