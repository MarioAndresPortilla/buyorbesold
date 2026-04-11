export default function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST" className="inline">
      <button
        type="submit"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)] hover:text-[color:var(--accent)] xs:text-[11px] xs:tracking-[0.15em]"
      >
        Sign out
      </button>
    </form>
  );
}
