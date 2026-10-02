// Run after extracting the pinned upstream public assets into resources/office.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const root = path.resolve('resources/office')
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (file.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8').replaceAll('https://oonxt.github.io/wasm-onlyoffice-demo/', '/office/')
      fs.writeFileSync(file, html)
    }
  }
}
walk(root)
for (const name of ['x2t.js', 'x2t.wasm']) {
  const file = path.join(root, 'x2t', name)
  const bytes = fs.readFileSync(file)
  try { fs.writeFileSync(file, zlib.brotliDecompressSync(bytes)) } catch { /* Already decompressed. */ }
}

fs.copyFileSync(path.join(root, "v9.3.0.24-1/web-apps/apps/common/main/resources/themes/themes.json"), path.join(root, "v9.3.0.24-1/themes.json"))
