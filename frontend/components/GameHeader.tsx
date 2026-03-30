import Link from "next/link";

export function GameHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="hero mini">
      <div>
        <p className="eyebrow">Brain Games Lab</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <Link href="/" className="btn ghost">
        Home
      </Link>
    </header>
  );
}