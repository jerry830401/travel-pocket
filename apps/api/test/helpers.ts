import { env, exports } from "cloudflare:workers";
import { sign } from "hono/jwt";
import { vi } from "vitest";
import type { Trip, TripEntry } from "@travel-pocket/shared";
import { upsertTripsStatement } from "../src/db/writes";

// Tests act as Cloudflare Access: they sign JWTs with their own RSA key and
// serve its public half from the team's certs URL, which the app fetches.

type Jwk = JsonWebKey & { kid: string; alg: string };

const KID = "test-key";
const ISSUER = `https://${env.ACCESS_TEAM_DOMAIN}`;
const CERTS_URL = `${ISSUER}/cdn-cgi/access/certs`;

async function generateSigningKey(): Promise<{ privateJwk: Jwk; publicJwk: Jwk }> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  const [privateJwk, publicJwk] = (await Promise.all([
    crypto.subtle.exportKey("jwk", pair.privateKey),
    crypto.subtle.exportKey("jwk", pair.publicKey),
  ])) as JsonWebKey[];
  return {
    privateJwk: { ...privateJwk, kid: KID, alg: "RS256" },
    publicJwk: { ...publicJwk, kid: KID, alg: "RS256" },
  };
}

const accessKey = await generateSigningKey();
/** A key Access never published, under the same kid. */
export const foreignKey = (await generateSigningKey()).privateJwk;

const originalFetch = globalThis.fetch;
vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === CERTS_URL) return Promise.resolve(Response.json({ keys: [accessKey.publicJwk] }));
  return originalFetch(input, init);
});

/** A JWT as Access would issue it for `email`; `claims` override the defaults. */
export function accessToken(
  email: string,
  claims: Record<string, unknown> = {},
  key: Jwk = accessKey.privateJwk
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      email,
      sub: `sub-${email}`,
      iss: ISSUER,
      aud: [env.ACCESS_AUD],
      iat: now,
      nbf: now,
      exp: now + 3600,
      ...claims,
    },
    key,
    "RS256"
  );
}

export const ALICE = "alice@example.com";
export const BOB = "bob@example.com";
export const CAROL = "carol@example.com";

/** `trip` as its owner lists it while nobody shares it. */
export function ownEntry(trip: Trip, ownerEmail = ALICE, version = 0): TripEntry {
  return { ...trip, version, role: "owner", ownerEmail, memberCount: 0, pendingCount: 0 };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Signs the request in as this email with a valid Access JWT. */
  as?: string;
  /** Sends this exact JWT instead. */
  token?: string;
  headers?: Record<string, string>;
  /** Defaults to a non-local host, where DEV_USER_EMAIL never applies. */
  origin?: string;
}

/** Strings and bytes are sent as they are; anything else as JSON. */
export async function api(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, as, token, headers = {}, origin = "https://api.test" } = options;
  const jwt = token ?? (as ? await accessToken(as) : undefined);
  const raw = body === undefined || typeof body === "string" || body instanceof Uint8Array;
  return exports.default.fetch(`${origin}/api${path}`, {
    method,
    headers: {
      ...(jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: raw ? body : JSON.stringify(body),
  });
}

/**
 * Gives `email` these trips under their own ids, straight in D1 the way the
 * seed does, since the API assigns ids itself. Signs the user in first.
 */
export async function insertTrips(email: string, trips: readonly Trip[]): Promise<void> {
  await api("/me", { as: email });
  const ownerId = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<string>("id");
  if (!ownerId) throw new Error(`No user for ${email}`);
  const { sql, params } = upsertTripsStatement(ownerId, trips);
  await env.DB.prepare(sql).bind(...params).run();
}

/**
 * PUTs `body` over a trip's list as a client that just read it would: with the
 * version the GET answered in `ETag` (or 0 when there was none).
 */
export async function replace(path: string, body: unknown, as = ALICE): Promise<Response> {
  const etag = (await api(path, { as })).headers.get("ETag") ?? '"0"';
  return api(path, { method: "PUT", body, as, headers: { "If-Match": etag } });
}

export async function resetDatabase(): Promise<void> {
  // Storage is isolated per test file, not per test. Deleting users cascades
  // to their trips, and from there to itinerary, shops, info and covers.
  await env.DB.prepare("DELETE FROM users").run();
}
