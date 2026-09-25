import type { DataType, Trip, TripDataMap } from "./types";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

/** True when the build points at an API (`VITE_API_URL`); otherwise data is static JSON. */
export const apiEnabled = !!API_URL;

/** Editing is only offered on the dev server with an API behind it (`pnpm dev`). */
export const isDevMode = import.meta.env.DEV && apiEnabled;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Reads from the API when enabled, falling back to the static JSON under `data/`. */
async function load<T>(apiPath: string, staticPath: string): Promise<T> {
  const staticUrl = `${import.meta.env.BASE_URL}data/${staticPath}`;
  if (!API_URL) return getJson<T>(staticUrl);
  try {
    return await getJson<T>(`${API_URL}${apiPath}`);
  } catch {
    return getJson<T>(staticUrl);
  }
}

export function loadTrips(): Promise<Trip[]> {
  return load("/trips", "trips.json");
}

export function loadTripData<T extends DataType>(tripId: string, type: T): Promise<TripDataMap[T]> {
  return load(`/trips/${tripId}/${type}`, `${tripId}/${type}.json`);
}

async function put(apiPath: string, data: unknown): Promise<void> {
  if (!isDevMode) return;
  const res = await fetch(`${API_URL}${apiPath}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_ADMIN_TOKEN}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
}

export function saveTrips(trips: Trip[]): Promise<void> {
  return put("/trips", trips);
}

export function saveTripData<T extends DataType>(
  tripId: string,
  type: T,
  data: TripDataMap[T]
): Promise<void> {
  return put(`/trips/${tripId}/${type}`, data);
}
