const fs = require("fs")
const path = require("path")

const base = path.resolve(__dirname, "..")
const dist = path.join(base, "dist")

// 确保目标目录存在
fs.mkdirSync(path.join(dist, "popup"), { recursive: true })
fs.mkdirSync(path.join(dist, "icons"), { recursive: true })

// 复制 HTML 和 CSS
fs.copyFileSync(path.join(base, "src/popup/index.html"), path.join(dist, "popup/index.html"))
fs.copyFileSync(path.join(base, "src/popup/style.css"), path.join(dist, "popup/style.css"))

// 处理并生成 dist/manifest.json（去除 dist/ 前缀以适应解压目录直接加载）
const manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8"))
if (manifest.action?.default_popup) manifest.action.default_popup = manifest.action.default_popup.replace(/^dist\//, "")
if (manifest.background?.service_worker) manifest.background.service_worker = manifest.background.service_worker.replace(/^dist\//, "")
if (manifest.content_scripts) {
  for (const cs of manifest.content_scripts) {
    if (cs.js) cs.js = cs.js.map((j) => j.replace(/^dist\//, ""))
  }
}
fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

// 复制图标
const icons = ["icon16.png", "icon48.png", "icon128.png"]
for (const icon of icons) {
  const src = path.join(base, "icons", icon)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, "icons", icon))
  }
}

console.log("[Clipper] Assets copied to dist/ successfully.")
