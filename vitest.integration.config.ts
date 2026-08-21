import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Every file talks to the same database, so they run one at a time.
    fileParallelism: false,
    // Vitest takes teardown as a named export of the globalSetup file; there
    // is no separate globalTeardown option, and an unknown key is ignored
    // rather than rejected.
    globalSetup: ["./tests/integration/global-setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
  },
});
