import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyWithJwks } from "hono/jwt";
import { ensureUser } from "./db";
import { normalizeEmail } from "./email";

export type AppEnv = {
  Bindings: Env;
  Variables: { userId: string; email: string };
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Cloudflare Access puts the signed-in user's JWT in this header on every
// request it lets through.
async function emailFromAccess(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  try {
    const payload = await verifyWithJwks(
      token,
      {
        jwks_uri: `${issuer}/cdn-cgi/access/certs`,
        allowedAlgorithms: ["RS256"],
        verification: { iss: issuer, aud: env.ACCESS_AUD },
      },
      // Let the edge cache the signing keys instead of fetching them per request.
      { cf: { cacheTtl: 300, cacheEverything: true } }
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// wrangler dev has no Access in front of it. DEV_USER_EMAIL stands in, but only
// for requests to localhost, so it can never take effect on a deployed Worker.
function emailFromDevConfig(req: Request, env: Env): string | null {
  if (!env.DEV_USER_EMAIL) return null;
  return LOCAL_HOSTS.has(new URL(req.url).hostname) ? env.DEV_USER_EMAIL : null;
}

/** Resolves the signed-in user (creating it on first sight), or responds 401. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const email =
    (await emailFromAccess(c.req.raw, c.env)) ?? emailFromDevConfig(c.req.raw, c.env);
  if (!email) throw new HTTPException(401, { message: "Sign in required" });
  const normalized = normalizeEmail(email);
  c.set("email", normalized);
  c.set("userId", await ensureUser(c.env.DB, normalized));
  await next();
});
