// Build-time download only. Application runtime uses these bundled assets offline.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const directory = path.resolve("src/renderer/public/vendor/imgly/1.7.0")
const base = "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/"
const keys = ["/models/isnet_fp16", "/onnxruntime-web/ort-wasm-simd-threaded.wasm", "/onnxruntime-web/ort-wasm-simd-threaded.mjs"]
fs.mkdirSync(directory, { recursive: true })
const manifestPath = path.join(directory, "resources.json")

/** Downloads download. */
function download(name, target) {
  execFileSync("curl", ["-L", "--fail", "--retry", "2", "--max-time", "120", "--silent", "--show-error", "-o", target, base + name], { stdio: "inherit" })
}
let manifest
if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
else {
  if (process.argv.includes("--check")) throw new Error("缺少本地换底模型，请运行 npm run assets:matting")
  const temp = manifestPath + ".tmp"
  download("resources.json", temp)
  const full = JSON.parse(fs.readFileSync(temp, "utf8"))
  manifest = Object.fromEntries(
    keys.map((key) => {
      if (!full[key]) throw new Error("换底资源清单不完整")
      return [key, full[key]]
    })
  )
  fs.unlinkSync(temp)
}
for (const key of keys) {
  const entry = manifest[key]
  if (!entry) throw new Error("缺少换底资源：" + key)
  for (const chunk of entry.chunks) {
    if (!/^[a-f0-9]{64}$/.test(chunk.name)) throw new Error("换底资源路径异常")
    const target = path.join(directory, chunk.name)

    /** Performs the valid operation. */
    const valid = () => fs.existsSync(target) && fs.statSync(target).size === chunk.offsets[1] - chunk.offsets[0] && crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") === chunk.hash
    if (!valid()) {
      if (process.argv.includes("--check")) throw new Error("换底资源缺失或损坏，请运行 npm run assets:matting")
      console.log("Downloading bundled matting asset:", chunk.name)
      const temp = target + ".tmp"
      download(chunk.name, temp)
      fs.renameSync(temp, target)
      if (!valid()) throw new Error("换底资源校验失败：" + chunk.name)
    }
  }
}
if (!process.argv.includes("--check")) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  const packageDirectory = path.dirname(require("node:module").createRequire(path.resolve("packages/@vessel/image-matting/package.json")).resolve("@imgly/background-removal")).replace(/[/\\]dist$/, "")
  for (const name of ["LICENSE.md", "ThirdPartyLicenses.json"]) fs.copyFileSync(path.join(packageDirectory, name), path.join(directory, name))
}
console.log("IS-Net local assets verified (model + matching WASM runtime).")
