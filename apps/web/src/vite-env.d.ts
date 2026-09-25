/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** API base URL, e.g. `/api` or `https://<worker>.workers.dev/api`. Unset → static JSON only. */
  readonly VITE_API_URL?: string;
}
