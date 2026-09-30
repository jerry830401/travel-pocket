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
 * Where the 現在 line goes among a day's sorted items at `now` (minutes since
 * midnight): before the first item that has not started yet, by its start time
 * or, for an arrival, its end time. Untimed items stay with the item before
 * them. items.length once every item has started.
 */
export function nowIndex(items: ItineraryItem[], now: number): number {
  let idx = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    const mins = toMins(items[i].startTime) ?? toMins(items[i].endTime);
    if (mins === null) continue;
    if (mins <= now) break;
    idx = i;
  }
  return idx;
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
