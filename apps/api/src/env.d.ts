// Local-only variable: the `dev` scripts pass it with `wrangler dev --var`, and
// it is never configured for a deployed Worker, so `wrangler types` cannot see
// it. Both Env types need it: the global one (handlers) and Cloudflare.Env (the
// `env` export of cloudflare:workers, used by tests).

interface Env {
  /** Identity for requests to localhost while no Access JWT is present. */
  DEV_USER_EMAIL?: string;
}

declare namespace Cloudflare {
  interface Env {
    DEV_USER_EMAIL?: string;
  }
}
