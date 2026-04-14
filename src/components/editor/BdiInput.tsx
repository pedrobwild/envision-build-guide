/* ── BDI input (simple, no per-item warnings) ── */
export function BdiInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder="0"
      step="0.01"
      className="w-full h-9 px-3 rounded border border-transparent bg-transparent text-sm font-mono text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border hover:border-border transition-colors duration-100 tabular-nums text-right font-body"
    />
  );
}
