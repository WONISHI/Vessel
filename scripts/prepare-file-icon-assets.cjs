const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
for (const id of ['catppuccin', 'symbols']) {
  const archive = fs.readFileSync(path.join(root, `resources/file-icons/${id}.json.gz`))
  const hash = crypto.createHash('sha256').update(archive).digest('hex')
  const destination = path.join(root, `src/renderer/public/vendor/file-icons/${id}`), stamp = path.join(destination, '.version')
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === hash) continue
  const files = JSON.parse(zlib.gunzipSync(archive))
  for (const [relative, svg] of Object.entries(files)) {
    if (relative.includes('..') || path.isAbsolute(relative) || !relative.endsWith('.svg') || typeof svg !== 'string') throw new Error('Invalid icon archive')
    const target = path.join(destination, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, svg)
  }
  fs.copyFileSync(path.join(root, `resources/file-icons/${id}.LICENSE`), path.join(destination, 'LICENSE'))
  fs.writeFileSync(stamp, hash)
}
