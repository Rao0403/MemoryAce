import Link from "next/link";

import { PlayerNameInput } from "@/components/PlayerNameInput";

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
            <Link href="/games/number-memory" className="btn">
              Start Number Memory
            </Link>
            <Link href="/games/verbal-memory" className="btn secondary">
              Start Verbal Memory
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
        <article className="panel menu-card">
          <h2>Number Memory</h2>
          <p>
            Start from 1 digit and push your recall ceiling with one extra digit each round.
          </p>
          <Link href="/games/number-memory" className="btn">
            Play Game
          </Link>
        </article>

        <article className="panel menu-card">
          <h2>Sequence Memory</h2>
          <p>
            Watch a growing glow-chain on a 3x3 board, then replay the exact sequence without mistakes.
          </p>
          <Link href="/games/sequence-memory" className="btn secondary">
            Play Game
          </Link>
        </article>

        <article className="panel menu-card">
          <h2>Dashboard</h2>
          <p>
            View your total attempts, per-game high scores, averages, and which game you perform best at.
          </p>
          <Link href="/dashboard" className="btn ghost">
            View Stats
          </Link>
        </article>

        <article className="panel menu-card">
          <h2>Verbal Memory</h2>
          <p>
            Judge each word as Seen or New. One mistake costs a life, and the stream gets trickier over time.
          </p>
          <Link href="/games/verbal-memory" className="btn secondary">
            Play Game
          </Link>
        </article>
      </section>

      <section className="identity-section">
        <PlayerNameInput />
      </section>
    </main>
  );
}
