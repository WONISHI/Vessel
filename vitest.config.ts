import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/main/**/*.ts", "src/preload/**/*.ts", "src/renderer/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/index.type.ts"]
    }
  }
})
