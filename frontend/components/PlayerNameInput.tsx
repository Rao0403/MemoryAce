"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PLAYER_KEY = "bf_player_name";

type PlayerNameInputProps = {
  showQuickLinks?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
  onSave?: (playerName: string) => void;
};

export function PlayerNameInput({
  showQuickLinks = false,
  title = "Player Identity",
  description = "Used for your high score and average score in MySQL.",
  buttonLabel = "Save",
  onSave,
}: PlayerNameInputProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    const existing = window.localStorage.getItem(PLAYER_KEY) ?? "";
    setName(existing);
  }, []);

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredPlayerName(trimmed);
    setName(trimmed);
    onSave?.(trimmed);
  }

  return (
    <div className="panel compact">
      <p className="panel-title">{title}</p>
      <div className="input-row">
        <input
          className="text-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter your player name"
          maxLength={64}
        />
        <button className="btn" onClick={saveName} type="button">
          {buttonLabel}
        </button>
      </div>
      <p className="muted">{description}</p>
      {showQuickLinks && (
        <>
          <Link href="/games/number-memory" className="btn secondary">
            Play Number Memory
          </Link>
          <Link href="/games/verbal-memory" className="btn secondary">
            Play Verbal Memory
          </Link>
          <Link href="/games/sequence-memory" className="btn ghost">
            Play Sequence Memory
          </Link>
        </>
      )}
    </div>
  );
}

export function getStoredPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PLAYER_KEY) ?? "";
}

export function setStoredPlayerName(playerName: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYER_KEY, playerName);
}
