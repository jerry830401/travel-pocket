import type { IconName } from "./components/icons";

/* An info card's `icon` is free text: an icon name such as "Plane" or
   "Landmark", or an emoji. Known names (any case, with or without - or _)
   draw a line icon; anything else is shown as typed. */
const NAMES: Record<string, IconName> = {
  plane: "plane",
  flight: "plane",
  landmark: "landmark",
  train: "train",
  trainfront: "train",
  bus: "bus",
  car: "car",
  ship: "ship",
  hotel: "bed",
  bed: "bed",
  beddouble: "bed",
  utensils: "utensils",
  utensilscrossed: "utensils",
  food: "utensils",
  shoppingbag: "bag",
  bag: "bag",
  ticket: "ticket",
  wallet: "card",
  creditcard: "card",
  wifi: "wifi",
  map: "map",
  mappin: "pin",
  info: "info",
  link: "link",
};

export function infoIconName(icon: string): IconName | null {
  return NAMES[icon.toLowerCase().replace(/[-_\s]/g, "")] ?? null;
}
