import Link from "next/link";

export function GameHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="hero mini">
      <div>
        <p className="eyebrow">Brain Games Lab</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">
        <Link href="/dashboard" className="btn ghost">
          Dashboard
        </Link>
        <Link href="/" className="btn ghost">
          Home
        </Link>
      </div>
    </header>
  );
}
