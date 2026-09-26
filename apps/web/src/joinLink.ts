/**
 * Invite links carry their code in the query (`/?join=<code>`, see
 * `inviteLink`), because Cloudflare Access sends a signed-out visitor back to
 * the path and query after sign-in, but never sees the hash. This moves the
 * code into the hash route (`#/join/<code>`) before the router starts, and
 * drops it from the query so a reload does not open the join page again.
 */
export function routeJoinLink(): void {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("join");
  if (code === null) return;
  url.searchParams.delete("join");
  url.hash = `#/join/${encodeURIComponent(code)}`;
  window.history.replaceState(null, "", url);
}
