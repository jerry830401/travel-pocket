import type { DataType, Me, NewTrip, Trip, TripDataMap } from "./types";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

/** True when the build points at an API (`VITE_API_URL`); otherwise data is static JSON. */
export const apiEnabled = !!API_URL;

/**
 * Added by the service worker to API responses it answers from its cache
 * (see the `trip-api` rule in vite.config.ts, which repeats the name because
 * the service worker code cannot import it).
 */
export const SW_CACHE_HEADER = "X-Travel-Pocket-Cache";

/** Cache Storage name of that rule, cleared on sign-out. */
const API_CACHE = "trip-api";

/**
 * `editable` is true only for data read live from the API. `PUT` replaces a
 * whole list, so saving edits made on the static fallback or on a cached copy
 * could overwrite newer data in the database.
 */
export interface Loaded<T> {
  data: T;
  editable: boolean;
}

/** The API call found no signed-in user. */
export class SignInRequiredError extends Error {
  constructor() {
    super("請先登入");
    this.name = "SignInRequiredError";
  }
}

const signedOutListeners = new Set<() => void>();

/** Called whenever an API call finds no signed-in user. Returns an unsubscribe function. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => {
    signedOutListeners.delete(listener);
  };
}

/**
 * Reloads through the network, where Cloudflare Access shows its login page
 * to a signed-out visitor (the service worker never answers navigations from
 * its cache while online).
 */
export function goToSignIn(): void {
  window.location.reload();
}

// Cloudflare Access answers a request without a valid session with a redirect
// to its login page. `redirect: "manual"` turns that into an opaque redirect
// here instead of a failed cross-origin fetch; the API itself answers 401.
async function apiFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_URL}${apiPath}`, { ...init, redirect: "manual" });
  if (res.type === "opaqueredirect" || res.status === 401) {
    for (const listener of signedOutListeners) listener();
    throw new SignInRequiredError();
  }
  return res;
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res;
}

async function loadStatic<T>(staticPath: string): Promise<Loaded<T>> {
  const res = await get(`${import.meta.env.BASE_URL}data/${staticPath}`);
  return { data: (await res.json()) as T, editable: false };
}

async function load<T>(apiPath: string, staticPath: string): Promise<Loaded<T>> {
  if (!API_URL) return loadStatic(staticPath);
  try {
    const res = await apiFetch(apiPath);
    if (!res.ok) throw new Error(`GET ${apiPath} failed: ${res.status}`);
    return { data: (await res.json()) as T, editable: !res.headers.has(SW_CACHE_HEADER) };
  } catch (err) {
    // Only the dev server still serves the static JSON (from packages/data);
    // production builds no longer ship it. Signing in is never papered over.
    if (!import.meta.env.DEV || err instanceof SignInRequiredError) throw err;
    return loadStatic(staticPath);
  }
}

export function loadTrips(): Promise<Loaded<Trip[]>> {
  return load("/trips", "trips.json");
}

export function loadTripData<T extends DataType>(
  tripId: string,
  type: T
): Promise<Loaded<TripDataMap[T]>> {
  return load(`/trips/${tripId}/${type}`, `${tripId}/${type}.json`);
}

/** The signed-in user, or null without an API, when signed out, or when it cannot be reached. */
export async function loadMe(): Promise<Me | null> {
  if (!API_URL) return null;
  try {
    const res = await apiFetch("/me");
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
}

// Same-origin requests carry the Cloudflare Access cookie, which is all the
// API needs to know who is asking.
async function send(method: "POST" | "PUT" | "DELETE", apiPath: string, body?: unknown) {
  if (!API_URL) throw new Error("Editing needs the API");
  const res = await apiFetch(apiPath, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res;
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await send("PUT", "/trips", trips);
}

export async function createTrip(trip: NewTrip): Promise<Trip> {
  return (await (await send("POST", "/trips", trip)).json()) as Trip;
}

export async function deleteTrip(tripId: string): Promise<void> {
  await send("DELETE", `/trips/${tripId}`);
}

export async function saveTripData<T extends DataType>(
  tripId: string,
  type: T,
  data: TripDataMap[T]
): Promise<void> {
  await send("PUT", `/trips/${tripId}/${type}`, data);
}

/**
 * Drops this browser's cached API responses, so the next person on the device
 * never sees them, then ends the Cloudflare Access session.
 */
export async function signOut(): Promise<void> {
  try {
    await caches.delete(API_CACHE);
  } catch {
    // Cache Storage is unavailable (e.g. insecure context); nothing to clear.
  }
  window.location.assign("/cdn-cgi/access/logout");
}
