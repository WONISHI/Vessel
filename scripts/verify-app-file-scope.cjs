/* eslint-disable @typescript-eslint/no-require-imports */
const { createRequire } = require("node:module")

/** Reject accidental project-wide inclusion, even if the package still starts. */
function verifyAppFileScope(archive) {
  const builderRequire = createRequire(require.resolve("electron-builder"))
  const asar = createRequire(builderRequire.resolve("app-builder-lib"))("@electron/asar")
  asar.uncache(archive)
  const unexpected = new Set()
  for (const entry of asar.listPackage(archive)) {
    const first = entry.replace(/^\//, "").split("/")[0]
    if (!["out", "node_modules", "package.json"].includes(first)) unexpected.add(first)
  }
  if (unexpected.size) throw new Error(`Unexpected application package roots: ${[...unexpected].join(", ")}. Check platform files allowlists.`)
  console.log("Packaged application scope OK: out, production dependencies, package.json")
}

module.exports = { verifyAppFileScope }
