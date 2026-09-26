import type { ItineraryItem } from "../types";

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

/**
 * A day's items in time order: by start time, or by end time for an item with
 * only that (an arrival). An item with neither stays after the one before it,
 * and items at the same time keep their order.
 */
export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  // Each timed item leads a group with the untimed items after it; untimed
  // items before the first timed one form a group that stays first.
  const groups: { mins: number; items: ItineraryItem[] }[] = [];
  for (const item of items) {
    const mins = toMins(item.startTime) ?? toMins(item.endTime);
    if (mins === null && groups.length) groups[groups.length - 1].items.push(item);
    else groups.push({ mins: mins ?? -1, items: [item] });
  }
  return groups.sort((a, b) => a.mins - b.mins).flatMap((g) => g.items);
}
