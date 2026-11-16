import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against a real Postgres and Redis (the `leads_test` database by
// default, see test/integration/setup.ts). One file at a time: they share the database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["test/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/server-only.stub.ts"),
    },
  },
});
