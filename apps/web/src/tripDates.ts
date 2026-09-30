/* Trip dates are YYYY-MM-DD strings in the trip's own calendar. */

/** Today on this device, as YYYY-MM-DD. */
export function todayStr(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

/** How many days a trip lasts, counting both ends. */
export function tripDays(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

export type TripStatus =
  | { kind: "upcoming"; daysLeft: number }
  | { kind: "ongoing"; day: number; total: number }
  | { kind: "ended" };

/** Where today falls against a trip: before it, on day N of it, or after it. */
export function tripStatus(startDate: string, endDate: string, today = todayStr()): TripStatus {
  if (today < startDate) return { kind: "upcoming", daysLeft: daysBetween(today, startDate) };
  if (today > endDate) return { kind: "ended" };
  return { kind: "ongoing", day: daysBetween(startDate, today) + 1, total: tripDays(startDate, endDate) };
}

/** "2026-12-20 → 12-27"; the end keeps its year only when the trip runs into the next one. */
export function dateRange(startDate: string, endDate: string): string {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return `${startDate} → ${sameYear ? endDate.slice(5) : endDate}`;
}

/** 春, 夏, 秋 or 冬, by the month a trip starts. */
export function season(startDate: string): string {
  const m = parseInt(startDate.split("-")[1], 10);
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}
