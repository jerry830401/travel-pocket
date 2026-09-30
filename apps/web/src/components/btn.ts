/* The app's pill buttons, used with className="font-hand font-bold":
   primary (ink), accent (red), ok (green) are filled; outline, danger (red)
   and muted (soft ink) are outlined; add is dashed. Text on a colored fill
   uses --on-accent, which is dark in dark mode so it stays readable. */
type Variant = "primary" | "accent" | "ok" | "outline" | "danger" | "muted" | "add";

const COLORS: Record<Variant, { border: string; background: string; color: string }> = {
  primary: { border: "var(--ink)", background: "var(--ink)", color: "var(--paper)" },
  accent: { border: "var(--red)", background: "var(--red)", color: "var(--on-accent)" },
  ok: { border: "var(--green)", background: "var(--green)", color: "var(--on-accent)" },
  outline: { border: "var(--ink)", background: "transparent", color: "var(--ink)" },
  danger: { border: "var(--red)", background: "transparent", color: "var(--red)" },
  muted: { border: "var(--ink-soft)", background: "transparent", color: "var(--ink-soft)" },
  add: { border: "var(--ink)", background: "transparent", color: "var(--ink)" },
};

/** A pill `height` px tall (36 in lists, 40 by default, 46 for a sheet's actions). */
export function btn(variant: Variant, height = 40): React.CSSProperties {
  const { border, background, color } = COLORS[variant];
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    flexShrink: 0, whiteSpace: "nowrap", cursor: "pointer",
    height, padding: `0 ${height >= 46 ? 20 : height >= 40 ? 16 : 14}px`, borderRadius: height / 2,
    border: `1.5px ${variant === "add" ? "dashed" : "solid"} ${border}`,
    background, color,
    fontSize: height >= 46 ? 20 : height >= 40 ? 18 : 17,
  };
}
