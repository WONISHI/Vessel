const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")
const { build } = require("vite")

const base = path.resolve(__dirname, "..")
const dist = path.join(base, "dist")
const repoRoot = path.resolve(base, "../../..")

/** Performs the main operation. */
async function main() {
  console.log("[Clipper] Building with Vite...")
  fs.mkdirSync(dist, { recursive: true })
  fs.mkdirSync(path.join(dist, "popup"), { recursive: true })
  fs.mkdirSync(path.join(dist, "icons"), { recursive: true })

  // 1. Bundle popup
  await build({
    root: base,
    configFile: false,
    build: {
      outDir: dist,
      emptyOutDir: false,
      lib: {
        entry: path.join(base, "src/popup/index.ts"),
        formats: ["es"],

        /** Performs the file name operation. */
        fileName: () => "popup/index.js"
      }
    }
  })

  // 2. Bundle background
  await build({
    root: base,
    configFile: false,
    build: {
      outDir: dist,
      emptyOutDir: false,
      lib: {
        entry: path.join(base, "src/background.ts"),
        formats: ["es"],

        /** Performs the file name operation. */
        fileName: () => "background.js"
      }
    }
  })

  // 3. Bundle content
  await build({
    root: base,
    configFile: false,
    build: {
      outDir: dist,
      emptyOutDir: false,
      lib: {
        entry: path.join(base, "src/content.ts"),
        name: "ClipperContent",
        formats: ["iife"],

        /** Performs the file name operation. */
        fileName: () => "content.js"
      }
    }
  })

  // 4. Bundle library entry
  await build({
    root: base,
    configFile: false,
    build: {
      outDir: dist,
      emptyOutDir: false,
      lib: {
        entry: path.join(base, "src/index.ts"),
        formats: ["es"],

        /** Performs the file name operation. */
        fileName: () => "index.js"
      }
    }
  })

  // 5. Copy HTML & CSS
  fs.copyFileSync(path.join(base, "src/popup/index.html"), path.join(dist, "popup/index.html"))
  fs.copyFileSync(path.join(base, "src/popup/style.css"), path.join(dist, "popup/style.css"))

  // 6. Manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8"))
  if (manifest.action?.default_popup) manifest.action.default_popup = manifest.action.default_popup.replace(/^dist\//, "")
  if (manifest.background?.service_worker) manifest.background.service_worker = manifest.background.service_worker.replace(/^dist\//, "")
  if (manifest.content_scripts) {
    for (const cs of manifest.content_scripts) {
      if (cs.js) cs.js = cs.js.map((j) => j.replace(/^dist\//, ""))
    }
  }
  // Ensure dist manifest (loaded by Electron) only has Electron-supported permissions
  manifest.permissions = (manifest.permissions || []).filter((p) => p !== "contextMenus" && p !== "downloads")
  fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

  // 7. Icons
  const icons = ["icon16.png", "icon48.png", "icon128.png"]
  for (const icon of icons) {
    const src = path.join(base, "icons", icon)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dist, "icons", icon))
    }
  }

  // 8. Generate zip in build/extensions/
  const extDir = path.join(repoRoot, "build/extensions")
  fs.mkdirSync(extDir, { recursive: true })
  try {
    const chromeManifest = {
      ...manifest,
      permissions: Array.from(new Set([...manifest.permissions, "contextMenus"]))
    }
    fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(chromeManifest, null, 2), "utf8")
    execSync(`cd "${dist}" && zip -r "${path.join(extDir, "vessel-clipper.zip")}" .`, { stdio: "ignore" })
    execSync(`cd "${dist}" && zip -r "${path.join(base, "vessel-clipper.zip")}" .`, { stdio: "ignore" })
  } catch {
  } finally {
    fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  }

  console.log("[Clipper] Build complete!")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
