import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-4 text-center text-[color:var(--text)]">
      <div className="font-bebas text-[120px] leading-none text-[color:var(--accent)]">
        404
      </div>
      <h1 className="font-bebas text-3xl tracking-wide">Page not found</h1>
      <p className="mt-3 max-w-md font-mono text-[12px] text-[color:var(--muted)]">
        The brief you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-[color:var(--accent)] bg-[color:var(--accent)] px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black hover:opacity-90"
      >
        Back to home
      </Link>
    </div>
  );
}
