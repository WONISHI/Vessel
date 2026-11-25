import { createRequire } from "node:module"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"
const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve("electron-builder"))
const asar = createRequire(builderRequire.resolve("app-builder-lib"))("@electron/asar")
const { verifyAppFileScope } = require("../../scripts/verify-app-file-scope.cjs")

it("rejects source, caches and removed resources accidentally copied into an app archive", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "vessel-app-scope-"))
  try {
    const source = path.join(temp, "app"), archive = path.join(temp, "app.asar")
    for (const name of ["out/main/index.js", "node_modules/runtime/index.js", "package.json"]) {
      const file = path.join(source, name)
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, name.endsWith(".json") ? "{}" : "")
    }
    await asar.createPackage(source, archive)
    expect(() => verifyAppFileScope(archive)).not.toThrow()
    for (const name of ["src/private.txt", "tmp/cache.txt", "resources/markitdown/python"]) {
      const file = path.join(source, name)
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, "should never ship")
    }
    const badArchive = path.join(temp, "bad.asar")
    await asar.createPackage(source, badArchive)
    expect(() => verifyAppFileScope(badArchive)).toThrow("Unexpected application package roots")
  } finally { await rm(temp, { recursive: true, force: true }) }
})
