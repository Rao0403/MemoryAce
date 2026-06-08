import Link from "next/link";

import { PlayerNameInput } from "@/components/PlayerNameInput";
import { GAME_DEFINITIONS, GAME_KEYS } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="page-wrap home-page">
      <section className="hero home-hero">
        <div>
          <p className="eyebrow">Brain Games Lab</p>
          <h1>MemoryAce: Train your brain with cinematic game loops.</h1>
          <p>
            MemoryAce is a refined benchmark-style platform where you build memory skills through
            fast, escalating rounds. Every run is saved, and your long-term progress is visible on your dashboard.
          </p>
          <div className="hero-buttons">
            <Link href="/games/wordle" className="btn">
              Start Wordle
            </Link>
            <Link href="/games/number-memory" className="btn secondary">
              Start Number Memory
            </Link>
            <Link href="/dashboard" className="btn ghost">
              Open Dashboard
            </Link>
          </div>
        </div>
        <div className="orbs" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="cards home-cards">
        {GAME_KEYS.map((gameKey, index) => {
          const definition = GAME_DEFINITIONS[gameKey];
          return (
            <article className="panel menu-card" key={gameKey}>
              <h2>{definition.label}</h2>
              <p>{definition.description}</p>
              <Link href={definition.route} className={index % 2 === 0 ? "btn" : "btn secondary"}>
                Play Game
              </Link>
            </article>
          );
        })}

        <article className="panel menu-card">
          <h2>Dashboard</h2>
          <p>
            View your total attempts, per-game high scores, averages, and which game you perform best at.
          </p>
          <Link href="/dashboard" className="btn ghost">
            View Stats
          </Link>
        </article>

      </section>

      <section className="identity-section">
        <PlayerNameInput />
      </section>
    </main>
  );
}
