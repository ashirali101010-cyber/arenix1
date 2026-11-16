import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    pool: "forks",
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      include: ["packages/core/**/*.ts"],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
