import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
            urlPattern: /\/travel-pocket\/data\/.*\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "trip-data",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  base: "/travel-pocket/",
  server: {
    host: true,
  },
});
