/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises")
const path = require("node:path")
const { createHash } = require("node:crypto")
const required = ["v9.3.0.24-1/web-apps/apps/api/documents/api.js", "v9.3.0.24-1/web-apps/apps/api/documents/preload.html", "v9.3.0.24-1/web-apps/apps/documenteditor/main/index.html", "v9.3.0.24-1/sdkjs/word/sdk-all.js", "x2t/x2t.js", "x2t/x2t.wasm"]
module.exports = async (context) => {
  const root = context.electronPlatformName === "darwin" ? path.join(context.appOutDir, context.packager.appInfo.productFilename + ".app", "Contents/Resources") : path.join(context.appOutDir, "resources")
  require("./verify-app-file-scope.cjs").verifyAppFileScope(path.join(root, "app.asar"))
  if (context.electronPlatformName === "darwin") {
    for (const name of ["vessel-auth", "vessel-clipboard"]) {
      await fs.access(path.join(root, "app.asar.unpacked/out/main", name), fs.constants.X_OK)
    }
    console.log("Packaged native helpers OK")
  }
  const sqliteRoot = path.join(root, "app.asar.unpacked/node_modules/better-sqlite3")
  await fs.access(path.join(sqliteRoot, "build/Release/better_sqlite3.node"))
  for (const entry of ["deps", "src", "build/Release/obj", "build/Release/obj.target", "build/Release/.deps", "build/Release/sqlite3.a", "build/Release/sqlite3.lib", "build/Release/test_extension.node"]) {
    if (await fs.lstat(path.join(sqliteRoot, entry)).then(() => true, error => { if (error.code === "ENOENT") return false; throw error })) throw new Error(`SQLite build-only file packaged: ${entry}`)
  }
  console.log("Packaged SQLite runtime OK; build-only files excluded")
  const architecture = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64" }[context.arch]
  if (architecture) await require("./verify-native-target.cjs").verifyNativeTarget(path.join(root, "app.asar.unpacked/node_modules"), context.electronPlatformName, architecture)
  for (const entry of ["manifest.json", "popup/index.js", "content.js", "icons/icon16.png", "icons/icon48.png", "icons/icon128.png"]) {
    const source = await fs.readFile(path.resolve(__dirname, "../packages/@vessel/clipper/dist", entry))
    const packed = await fs.readFile(path.join(root, "extensions/clipper", entry))
    if (!source.equals(packed)) throw new Error(`Clipper resource corrupted: ${entry}`)
  }
  console.log("Packaged Clipper resources OK")
  if (context.electronPlatformName === "win32") {
    const arch = context.arch === 3 ? "arm64" : "x64"
    const nativeRoot = path.join(root, "app.asar.unpacked/node_modules")
    const { verifyPE } = require("#vessel-scripts/prepare-win-app")
    const watcher = path.join(nativeRoot, "@parcel", `watcher-win32-${arch}`, "watcher.node")
    await verifyPE(
      await fs.access(watcher).then(
        () => watcher,
        () => path.join(nativeRoot, "@parcel/watcher/build/Release/watcher.node")
      ),
      arch
    )
    await verifyPE(path.join(nativeRoot, "better-sqlite3/build/Release/better_sqlite3.node"), arch)
    await verifyPE(path.join(nativeRoot, "node-pty/prebuilds", `win32-${arch}`, "conpty.node"), arch)
  }
  for (const entry of required) {
    const original = await fs.readFile(path.resolve(__dirname, "../resources/office", entry))
    const packed = await fs.readFile(path.join(root, "office", entry))

    /** Hashes hash. */
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
    if (hash(original) !== hash(packed)) throw new Error(`ONLYOFFICE resource corrupted: ${entry}`)
  }
  const office = path.join(root, "office/v9.3.0.24-1/web-apps/apps")
  async function verifyLanguages(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (!entry.isDirectory()) continue
      if (entry.name === "locale" || entry.name === "formula-lang") {
        const names = await fs.readdir(target)
        const allowed = entry.name === "locale" ? /^(en|zh|zh-tw)\.json$/ : /^(en|zh|zh-tw)(_desc)?\.json$/
        for (const name of names.filter(name => name.endsWith(".json"))) {
          if (!allowed.test(name)) throw new Error(`Unsupported Office language packaged: ${target}/${name}`)
        }
        for (const language of ["en", "zh", "zh-tw"]) await fs.access(path.join(target, `${language}.json`))
      } else await verifyLanguages(target)
    }
  }
  await verifyLanguages(office)
  console.log("Packaged Office languages OK: en, zh, zh-tw")
}
