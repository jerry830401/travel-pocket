import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { tripDataPlugin } from "./vite-plugin-trip-data";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tripDataPlugin(),
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "icons/icon.svg",
        "icons/icon-192x192.svg",
        "icons/icon-512x512.svg",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "Travel Pocket",
        short_name: "Travel Pocket",
        description: "旅遊行程規劃與記錄",
        theme_color: "#1a3a5c",
        background_color: "#0f2340",
        display: "standalone",
        scope: "/travel-pocket/",
        start_url: "/travel-pocket/",
        icons: [
          {
            src: "/travel-pocket/icons/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "/travel-pocket/icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Matched on the pathname, which works whether the API is on this
            // origin or another one.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            method: "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "trip-api", // signOut() in src/dataSource.ts clears it
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              plugins: [
                {
                  // Marks answers from the cache (the network failed) so the
                  // app shows them read-only: see Loaded.editable in
                  // src/dataSource.ts. This function is serialized into the
                  // service worker, so the header name is a literal here.
                  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
                    if (!cachedResponse) return cachedResponse;
                    const headers = new Headers(cachedResponse.headers);
                    headers.set("X-Travel-Pocket-Cache", "1");
                    return new Response(await cachedResponse.blob(), {
                      status: cachedResponse.status,
                      statusText: cachedResponse.statusText,
                      headers,
                    });
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  base: "/travel-pocket/",
  server: {
    host: true,
    // `pnpm dev` (mode fullstack) sets VITE_API_URL=/api; forward it to wrangler dev.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
