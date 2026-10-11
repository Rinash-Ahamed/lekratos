import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // `server-only` throws outside React Server Components; the tests run the server code directly.
      "server-only": r("./tests/support/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/support/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
  },
});
