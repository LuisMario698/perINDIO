/** Boleto de rifa; el mismo dibujo que src/app/icon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="7" className="fill-foreground" />
      <path
        d="M7 11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.3a2.7 2.7 0 0 0 0 5.4V21a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.3a2.7 2.7 0 0 0 0-5.4Z"
        className="fill-background"
      />
      <path d="M19.5 10v12" strokeWidth="1.5" strokeDasharray="1.5 1.5" className="stroke-foreground" />
    </svg>
  );
}
