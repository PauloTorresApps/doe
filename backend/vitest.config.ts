import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/server.ts"],
    },
  },
});
