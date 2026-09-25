// Production entry on Cloudflare Workers. The static app is served from the
// assets; only /api/* reaches this code (assets.run_worker_first in
// wrangler.jsonc) and is handed to the API Worker through the service binding,
// Cloudflare Access headers included. The request is forwarded as is, over
// HTTP: nothing from apps/api is imported here.
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await env.API.fetch(request);
    } catch {
      // The API Worker is missing or failing; the app shows its error state.
      return Response.json({ error: "API unavailable" }, { status: 503 });
    }
  },
} satisfies ExportedHandler<Env>;
