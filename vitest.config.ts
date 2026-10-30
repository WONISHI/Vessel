import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      { find: /^@vessel\/obsidian\/callouts\/style\.css/, replacement: resolve("packages/@vessel/obsidian/src/callouts/style.css") },
      { find: /^@vessel\/obsidian$/, replacement: resolve("packages/@vessel/obsidian/src/index.ts") },
      ...Object.entries({
      "@resources": resolve("resources"),
      "#vessel-clipper": resolve("packages/@vessel/clipper/src"),
      "#vessel-obsidian": resolve("packages/@vessel/obsidian/src"),
      "#vessel-react-router": resolve("packages/@vessel/react-router/src"),
      "#vessel-sync": resolve("packages/@vessel/sync/src"),
      "#vessel-type": resolve("packages/@vessel/type/src"),
      "#vessel-utils": resolve("packages/@vessel/utils/src"),
      "@tests": resolve("tests"),
      "@preload": resolve("src/preload"),
      "@vessel/sync": resolve("packages/@vessel/sync/src/index.ts"),
      "@main": resolve("src/main"),
      "@": resolve("src/renderer/src")
      }).map(([find, replacement]) => ({ find, replacement }))
    ]
  },
  test: {
    projects: [
      { extends: true, test: { name: "main", environment: "node", include: ["tests/main/**/*.test.ts", "packages/@vessel/*/tests/**/*.test.ts"] } },
      { extends: true, test: { name: "renderer", environment: "jsdom", include: ["tests/renderer/**/*.test.ts", "tests/renderer/**/*.test.tsx"] } }
    ],
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
