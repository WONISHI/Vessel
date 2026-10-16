import { resolve } from "node:path"
import { defineConfig } from "vitest/config"
export default defineConfig({ resolve: { alias: { "#vessel-sync": resolve("src") } }, test: { include: ["tests/**/*.test.ts"], environment: "node" } })
