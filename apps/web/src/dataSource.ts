import { parseETagVersion, versionTag } from "@travel-pocket/shared";
import type {
  CoverUpload,
  DataType,
  Invite,
  Me,
  NewTrip,
  TripDataMap,
  TripEntry,
  TripInvite,
  TripMembers,
  TripUpdate,
} from "./types";

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
 * could overwrite newer data in the database. `version` is what the API
 * answered in `ETag` (a trip's list), and what a save of the data must name;
 * null when there is none (the trip list, the static JSON).
 */
export interface Loaded<T> {
  data: T;
  editable: boolean;
  version: number | null;
}

/** The API call found no signed-in user. */
export class SignInRequiredError extends Error {
  constructor() {
    super("請先登入");
    this.name = "SignInRequiredError";
  }
}

/** The data changed since it was read (412): someone else saved first. Nothing was written. */
export class ConflictError extends Error {
  constructor() {
    super("別人剛修改過");
    this.name = "ConflictError";
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
  return { data: (await res.json()) as T, editable: false, version: null };
}

async function load<T>(apiPath: string, staticPath: string): Promise<Loaded<T>> {
  if (!API_URL) return loadStatic(staticPath);
  try {
    const res = await apiFetch(apiPath);
    if (!res.ok) throw new Error(`GET ${apiPath} failed: ${res.status}`);
    return {
      data: (await res.json()) as T,
      editable: !res.headers.has(SW_CACHE_HEADER),
      version: parseETagVersion(res.headers.get("ETag")),
    };
  } catch (err) {
    // Only the dev server still serves the static JSON (from packages/data);
    // production builds no longer ship it. Signing in is never papered over.
    if (!import.meta.env.DEV || err instanceof SignInRequiredError) throw err;
    return loadStatic(staticPath);
  }
}

// The static JSON has plain trips, never edited or shared: they read as the
// viewer's own personal trips.
const STATIC_ENTRY = { version: 0, role: "owner", ownerEmail: "", memberCount: 0, pendingCount: 0 } as const;

export async function loadTrips(): Promise<Loaded<TripEntry[]>> {
  const loaded = await load<TripEntry[]>("/trips", "trips.json");
  return { ...loaded, data: loaded.data.map((trip) => ({ ...STATIC_ENTRY, ...trip })) };
}

export function loadTripData<T extends DataType>(
  tripId: string,
  type: T
): Promise<Loaded<TripDataMap[T]>> {
  return load(`/trips/${tripId}/${type}`, `${tripId}/${type}.json`);
}

/** A trip is shared once it has a member, or when the user is one. */
export function isShared(trip: TripEntry): boolean {
  return trip.role === "member" || trip.memberCount > 0;
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
async function callApi(apiPath: string, init: RequestInit): Promise<Response> {
  if (!API_URL) throw new Error("This needs the API");
  const res = await apiFetch(apiPath, init);
  if (res.status === 412) throw new ConflictError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res;
}

/** `version`: what the data was read at, sent as `If-Match` (see `ConflictError`). */
function send(method: "POST" | "PUT" | "DELETE", apiPath: string, body?: unknown, version?: number) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (version !== undefined) headers["If-Match"] = versionTag(version);
  return callApi(apiPath, {
    method,
    ...(Object.keys(headers).length > 0 && { headers }),
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** Reads what only the API has: no static fallback, and failures read like a write's. */
async function read<T>(apiPath: string): Promise<T> {
  return (await (await callApi(apiPath, {})).json()) as T;
}

export async function createTrip(trip: NewTrip): Promise<TripEntry> {
  return (await (await send("POST", "/trips", trip)).json()) as TripEntry;
}

/** Saves a trip's fields over `version` and resolves with the trip at its new version. */
export async function updateTrip(
  tripId: string,
  fields: TripUpdate,
  version: number
): Promise<TripEntry> {
  return (await (await send("PUT", `/trips/${tripId}`, fields, version)).json()) as TripEntry;
}

export async function deleteTrip(tripId: string): Promise<void> {
  await send("DELETE", `/trips/${tripId}`);
}

/**
 * Uploads the trip's cover and resolves with the `coverImage` URL the trip now
 * has, and the trip's new version.
 */
export async function uploadCover(tripId: string, image: Blob): Promise<CoverUpload> {
  const res = await callApi(`/trips/${tripId}/cover`, {
    method: "PUT",
    headers: { "Content-Type": image.type },
    body: image,
  });
  return (await res.json()) as CoverUpload;
}

/** Replaces a trip's list over `version` and resolves with its new version. */
export async function saveTripData<T extends DataType>(
  tripId: string,
  type: T,
  data: TripDataMap[T],
  version: number
): Promise<number> {
  const res = await send("PUT", `/trips/${tripId}/${type}`, data, version);
  return parseETagVersion(res.headers.get("ETag")) ?? version + 1;
}

/** Who shares the trip; pending requests and the invite code only reach its owner. */
export function loadMembers(tripId: string): Promise<TripMembers> {
  return read(`/trips/${tripId}/members`);
}

/** The trip's invite code, created the first time its owner asks. */
export async function createInvite(tripId: string): Promise<string> {
  return ((await (await send("POST", `/trips/${tripId}/invite`)).json()) as TripInvite).inviteCode;
}

/** The link that opens the join page for an invite code (see `App`'s `?join=`). */
export function inviteLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?join=${code}`;
}

const memberPath = (tripId: string, email: string) =>
  `/trips/${tripId}/members/${encodeURIComponent(email)}`;

/** The owner approves a request to join. */
export async function approveMember(tripId: string, email: string): Promise<void> {
  await send("PUT", memberPath(tripId, email));
}

/** The owner removes a member or turns down a request; a member passes their own email to leave. */
export async function removeMember(tripId: string, email: string): Promise<void> {
  await send("DELETE", memberPath(tripId, email));
}

/** The trip an invite code opens, and where the user stands with it; null for an unknown code. */
export async function loadInvite(code: string): Promise<Invite | null> {
  if (!API_URL) throw new Error("Invites need the API");
  const res = await apiFetch(`/invites/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Invite;
}

/** Asks the owner to let the user join; resolves with the invite at its new status. */
export async function requestJoin(code: string): Promise<Invite> {
  return (await (await send("POST", `/invites/${code}`)).json()) as Invite;
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
