const Module = require("node:module")
const path = require("node:path")
const { existsSync } = require("node:fs")
const originalResolve = Module._resolveFilename
const root = path.resolve(__dirname, "../..")
const aliases = { "@main/": "src/main", "@preload/": "src/preload", "@/": "src/renderer/src" }

/** Resolves application aliases for smoke scripts that transpile TypeScript through require.extensions. */
Module._resolveFilename = function resolveApplicationAlias(request, parent, ...options) {
  for (const [prefix, directory] of Object.entries(aliases)) {
    if (request.startsWith(prefix)) {
      request = path.join(root, directory, request.slice(prefix.length))
      for (const extension of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        if (existsSync(request + extension)) {
          request += extension
          break
        }
      }
      break
    }
  }
  return originalResolve.call(this, request, parent, ...options)
}
