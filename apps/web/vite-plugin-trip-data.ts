import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import { DATA_TYPES, ID_PATTERN } from "@travel-pocket/shared";

// Resolved through the package name so the location stays the package's concern.
const TRIP_DATA_DIR = path.dirname(
  createRequire(import.meta.url).resolve("@travel-pocket/data/trips.json")
);

const TYPE_FILES = new Set(DATA_TYPES.map((type) => `${type}.json`));

// Maps a path under data/ to a file in the package, or null when the path
// is not a trip data file (e.g. a cover image, which stays in public/data/).
function toDataFile(urlPath: string): string | null {
  const parts = urlPath.split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "trips.json") return "trips.json";
  if (parts.length === 2 && ID_PATTERN.test(parts[0]) && TYPE_FILES.has(parts[1])) {
    return `${parts[0]}/${parts[1]}`;
  }
  return null;
}

// Serves @travel-pocket/data at `${base}data/` on the dev server only: it backs
// `pnpm dev:web` and the fallback when the local API is down. Production builds
// do not ship trip data; signed-in users read their own trips from the API.
export function tripDataPlugin(): Plugin {
  return {
    name: "trip-data",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        `${server.config.base}data`,
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          if (req.method !== "GET" && req.method !== "HEAD") return next();
          const file = toDataFile((req.url ?? "/").split("?")[0]);
          if (!file) return next();
          try {
            const content = fs.readFileSync(path.join(TRIP_DATA_DIR, file), "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(content);
          } catch {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Not found" }));
          }
        }
      );
    },
  };
}
