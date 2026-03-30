import Link from "next/link";

import { PlayerNameInput } from "@/components/PlayerNameInput";

export default function HomePage() {
  return (
    <main className="page-wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">Brain Games Lab</p>
          <h1>Train memory with style.</h1>
          <p>
            A sharper and more cinematic take on Human Benchmark, with smooth visuals,
            game progression, and persistent score tracking.
          </p>
        </div>
        <div className="orbs" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="cards">
        <article className="panel">
          <h2>Number Memory</h2>
          <p>
            Start with 1 digit and climb one digit every round. Memorize, type, and survive
            as long as possible.
          </p>
          <Link href="/games/number-memory" className="btn">
            Play
          </Link>
        </article>

        <article className="panel">
          <h2>Sequence Memory</h2>
          <p>
            A 3x3 board lights up in expanding chains. Repeat the exact sequence to keep advancing.
          </p>
          <Link href="/games/sequence-memory" className="btn secondary">
            Play
          </Link>
        </article>

        <PlayerNameInput />
      </section>
    </main>
  );
}