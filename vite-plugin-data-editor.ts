import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_TYPES = new Set(["itinerary", "shops", "info"]);
const ALLOWED_SEGMENT = /^[a-zA-Z0-9_-]+$/;

function safePath(dataDir: string, ...parts: string[]): string | null {
  for (const p of parts) {
    if (!ALLOWED_SEGMENT.test(p)) return null;
  }
  const resolved = path.resolve(dataDir, ...parts) + ".json";
  if (!resolved.startsWith(dataDir)) return null;
  return resolved;
}

function readJson(res: ServerResponse, filePath: string) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  }
}

function writeJson(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string
) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const parsed = JSON.parse(body);
      fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });
}

export function dataEditorPlugin(): Plugin {
  let dataDir: string;

  return {
    name: "data-editor",
    apply: "serve",
    configResolved(config) {
      dataDir = path.resolve(config.root, "public", "data");
    },
    configureServer(server) {
      server.middlewares.use(
        "/api/data",
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const parts = (req.url ?? "/")
            .split("?")[0]
            .split("/")
            .filter(Boolean);

          // GET/POST /api/data/trips  →  public/data/trips.json
          if (parts.length === 1 && parts[0] === "trips") {
            const filePath = safePath(dataDir, "trips");
            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Bad request" }));
              return;
            }
            if (req.method === "GET") return readJson(res, filePath);
            if (req.method === "POST") return writeJson(req, res, filePath);
          }

          // GET/POST /api/data/:tripId/:type  →  public/data/:tripId/:type.json
          if (parts.length === 2 && ALLOWED_TYPES.has(parts[1])) {
            const filePath = safePath(dataDir, parts[0], parts[1]);
            if (!filePath) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Bad request" }));
              return;
            }
            if (req.method === "GET") return readJson(res, filePath);
            if (req.method === "POST") return writeJson(req, res, filePath);
          }

          next();
        }
      );
    },
  };
}
