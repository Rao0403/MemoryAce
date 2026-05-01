"use client";

import { useEffect, useMemo, useState } from "react";

import { GameHeader } from "@/components/GameHeader";
import { getStoredPlayerName } from "@/components/PlayerNameInput";
import { Leaderboard, PersonalStats } from "@/components/Scoreboards";
import { fetchLeaderboard, fetchStats, submitScore, type LeaderboardRow, type PlayerGameStats } from "@/lib/api";

type Phase = "idle" | "playing" | "gameover";

const GAME_KEY = "verbal_memory" as const;
const MAX_LIVES = 3;

const WORD_BANK = [
  "apple", "ocean", "river", "planet", "forest", "garden", "bridge", "window", "thunder", "pencil",
  "mountain", "camera", "castle", "summer", "winter", "spring", "autumn", "rocket", "signal", "pillow",
  "puzzle", "galaxy", "saturn", "violet", "copper", "marble", "glacier", "temple", "silver", "golden",
  "stream", "harbor", "circle", "square", "needle", "button", "blanket", "anchor", "sailor", "ticket",
  "museum", "desert", "island", "laptop", "keyboard", "orange", "banana", "straw", "planetary", "travel",
  "guitar", "violin", "piano", "drum", "melody", "rhythm", "thunderbolt", "library", "fiction", "poetry",
  "canvas", "painter", "studio", "engine", "engineer", "doctor", "artist", "breeze", "shadow", "sunrise",
  "sunset", "morning", "evening", "midnight", "coffee", "tea", "cocoa", "cookie", "biscuit", "pepper",
  "salt", "sugar", "honey", "butter", "cheese", "crystal", "diamond", "emerald", "amber", "sapphire",
  "falcon", "eagle", "sparrow", "robin", "parrot", "rabbit", "tiger", "lion", "zebra", "dolphin",
  "whale", "octopus", "planetarium", "compass", "lantern", "backpack", "journal", "novel", "chapter", "station",
];

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickNextWord(seenWords: string[]): string {
  const seenSet = new Set(seenWords);
  const unseenWords = WORD_BANK.filter((word) => !seenSet.has(word));
  const canUseSeen = seenWords.length > 0;
  const shouldUseSeen = canUseSeen && (unseenWords.length === 0 || Math.random() < 0.5);

  if (shouldUseSeen) {
    return randomFrom(seenWords);
  }
  if (unseenWords.length > 0) {
    return randomFrom(unseenWords);
  }
  return randomFrom(WORD_BANK);
}

export default function VerbalMemoryPage() {
  const [playerName, setPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [seenWords, setSeenWords] = useState<string[]>([]);
  const [statusText, setStatusText] = useState("Click New if first time this round, Seen if repeated.");
  const [isSaving, setIsSaving] = useState(false);

  const [stats, setStats] = useState<PlayerGameStats | null>(null);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);

  const seenCount = useMemo(() => new Set(seenWords).size, [seenWords]);

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

  function startGame() {
    setLives(MAX_LIVES);
    setScore(0);
    setSeenWords([]);
    setPhase("playing");
    setCurrentWord(randomFrom(WORD_BANK));
    setStatusText("Round started. Decide if each word is Seen or New.");
  }

  async function persistScore(finalScore: number) {
    if (!playerName) {
      setStatusText("Set a player name on Home before saving scores.");
      return;
    }

    setIsSaving(true);
    try {
      const personal = await submitScore({ playerName, game: GAME_KEY, score: finalScore });
      const leaderboard = await fetchLeaderboard(GAME_KEY);
      setStats(personal);
      setLeaderboardRows(leaderboard);
    } catch {
      setStatusText("Run ended, but score save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGuess(guessSeen: boolean) {
    if (phase !== "playing" || !currentWord) return;

    const actualSeen = seenWords.includes(currentWord);
    const isCorrect = guessSeen === actualSeen;

    const nextSeenWords = actualSeen ? seenWords : [...seenWords, currentWord];
    if (!actualSeen) {
      setSeenWords(nextSeenWords);
    }

    let nextScore = score;
    let nextLives = lives;

    if (isCorrect) {
      nextScore += 1;
      setScore(nextScore);
    } else {
      nextLives -= 1;
      setLives(nextLives);
    }

    if (nextLives <= 0) {
      setPhase("gameover");
      setStatusText(`Game over. Final score: ${nextScore}.`);
      await persistScore(nextScore);
      return;
    }

    setCurrentWord(pickNextWord(nextSeenWords));
    if (isCorrect) {
      setStatusText("Correct. Keep going.");
    } else {
      setStatusText(`Wrong. ${nextLives} ${nextLives === 1 ? "life" : "lives"} remaining.`);
    }
  }

  return (
    <main className="page-wrap game-page">
      <GameHeader title="Verbal Memory" subtitle="Choose whether each word is Seen or New." />

      <section className="game-center">
        <article className="panel game-surface">
          <div className="hud-row">
            <span className="chip">Score {score}</span>
            <span className="chip">Lives {lives}</span>
            <span className="chip">Unique Words {seenCount}</span>
            {playerName ? <span className="chip">{playerName}</span> : <span className="chip warning">No player name</span>}
          </div>

          {phase === "idle" && (
            <div className="center-stack">
              <h2>Ready?</h2>
              <p className="muted">Mark each word correctly to build your streak.</p>
              <button className="btn" type="button" onClick={startGame}>
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
              <p className="muted">{isSaving ? "Saving score..." : "Score recorded."}</p>
              <button className="btn" type="button" onClick={startGame}>
                Play Again
              </button>
            </div>
          )}

          <p className="status-line">{statusText}</p>
        </article>

        <aside className="game-meta-grid">
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
