import { describe, it, expect, vi } from "vitest";
import worker from "./index";

function fetcher(body: string) {
  return { fetch: vi.fn(async () => new Response(body)) };
}

// Worker handlers are typed for requests arriving at the edge (with `cf`
// properties); a plain Request stands in for one here.
function incoming(path: string, init?: RequestInit) {
  return new Request(`https://travel-pocket.example.workers.dev${path}`, init) as Request<
    unknown,
    IncomingRequestCfProperties
  >;
}

function setup() {
  const API = fetcher("from api");
  const ASSETS = fetcher("from assets");
  return { API, ASSETS, env: { API, ASSETS } as unknown as Env };
}

describe("worker", () => {
  it.each(["/", "/index.html", "/assets/index-abc.js", "/apps.json"])(
    "serves %s from the static assets",
    async (path) => {
      const { API, ASSETS, env } = setup();
      const request = incoming(path);
      const res = await worker.fetch(request, env);
      expect(await res.text()).toBe("from assets");
      expect(ASSETS.fetch).toHaveBeenCalledWith(request);
      expect(API.fetch).not.toHaveBeenCalled();
    }
  );

  it.each(["/api/trips", "/api/trips/kyushu-2024/shops", "/api"])(
    "forwards %s to the API unchanged, Access headers included",
    async (path) => {
      const { API, ASSETS, env } = setup();
      const request = incoming(path, {
        method: "PUT",
        headers: { "Cf-Access-Jwt-Assertion": "jwt" },
        body: "[]",
      });
      const res = await worker.fetch(request, env);
      expect(await res.text()).toBe("from api");
      expect(API.fetch).toHaveBeenCalledWith(request);
      expect(ASSETS.fetch).not.toHaveBeenCalled();
    }
  );

  it("answers 503 when the API Worker cannot be reached", async () => {
    const { API, env } = setup();
    API.fetch.mockRejectedValue(new Error("service not found"));
    const res = await worker.fetch(incoming("/api/me"), env);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "API unavailable" });
  });
});
