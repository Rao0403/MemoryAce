import { PlayerNameInput } from "@/components/PlayerNameInput";
import { Leaderboard, PersonalStats } from "@/components/Scoreboards";
import { GameHeader } from "@/components/GameHeader";
import type { LeaderboardRow, PlayerGameStats } from "@/lib/api";

type GameHudItem = {
  label?: string;
  value: string;
  tone?: "default" | "warning";
};

type GameShellProps = {
  title: string;
  subtitle: string;
  hudItems: GameHudItem[];
  statusText: string;
  noticeText?: string;
  playerName: string;
  hasPlayerName: boolean;
  stats: PlayerGameStats | null;
  leaderboardRows: LeaderboardRow[];
  isLoadingMeta: boolean;
  isSavingResult: boolean;
  metaError: string;
  onPlayerNameSaved: (playerName: string) => void;
  children: React.ReactNode;
};

export function GameShell({
  title,
  subtitle,
  hudItems,
  statusText,
  noticeText = "",
  playerName,
  hasPlayerName,
  stats,
  leaderboardRows,
  isLoadingMeta,
  isSavingResult,
  metaError,
  onPlayerNameSaved,
  children,
}: GameShellProps) {
  return (
    <main className="page-wrap game-page">
      <GameHeader title={title} subtitle={subtitle} />

      <section className="game-center">
        <article className="panel game-surface">
          <div className="hud-row">
            {hudItems.map((item) => (
              <span
                className={`chip ${item.tone === "warning" ? "warning" : ""}`}
                key={`${item.label ?? "value"}-${item.value}`}
              >
                {item.label ? `${item.label} ${item.value}` : item.value}
              </span>
            ))}
            {playerName ? <span className="chip">{playerName}</span> : <span className="chip warning">No player name</span>}
          </div>

          {!hasPlayerName && (
            <div className="inline-name-gate">
              <PlayerNameInput
                title="Tracked runs require a player name"
                description="Save a local player name before starting this game."
                buttonLabel="Save Name"
                onSave={onPlayerNameSaved}
              />
            </div>
          )}

          {noticeText && <p className="notice-text">{noticeText}</p>}

          {children}

          <p className="status-line">{statusText}</p>
        </article>

        <aside className="game-meta-grid">
          <article className="panel compact">
            <p className="panel-title">Your Stats</p>
            {isLoadingMeta ? <p className="muted">Loading scores...</p> : <PersonalStats stats={stats} />}
            {isSavingResult && <p className="muted">Saving latest score...</p>}
            {metaError && <p className="error-text">{metaError}</p>}
          </article>
          <article className="panel compact">
            <p className="panel-title">Top Players</p>
            {isLoadingMeta && leaderboardRows.length === 0 ? (
              <p className="muted">Loading leaderboard...</p>
            ) : (
              <Leaderboard rows={leaderboardRows} />
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}
