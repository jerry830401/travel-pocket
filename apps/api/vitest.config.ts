import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Test-only bindings: migrations for test/apply-migrations.ts, a fixed
          // Access setup (tests sign their own JWTs for this team and AUD), and
          // the dev identity the `dev` scripts pass with --var.
          bindings: {
            TEST_MIGRATIONS: migrations,
            ACCESS_TEAM_DOMAIN: "travel-pocket-test.cloudflareaccess.com",
            ACCESS_AUD: "test-aud",
            DEV_USER_EMAIL: "dev@example.com",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
