import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside a Next.js server bundle; tests run in plain Node.
      "server-only": path.resolve(__dirname, "test/server-only.stub.ts"),
    },
  },
});
