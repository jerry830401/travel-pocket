export function toMins(s: string | undefined) {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function gapLabel(diff: number | null) {
  if (!diff || diff <= 0) return null;
  const h = Math.floor(diff / 60), m = diff % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export function dateBig(d: string) {
  const [, mo, dy] = d.split("-");
  return `${mo} / ${dy}`;
}

export function weekday(d: string) {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(d).getDay()];
}
