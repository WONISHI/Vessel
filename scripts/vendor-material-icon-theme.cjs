// Import the official npm release without executing extension code.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto')
const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/vendor-material-icon-theme.cjs <package-root>')
const root = path.resolve(__dirname, '..')
const theme = JSON.parse(fs.readFileSync(path.join(source, 'dist/material-icons.json'), 'utf8'))
const files = Object.fromEntries(fs.readdirSync(path.join(source, 'icons')).filter(name => name.endsWith('.svg')).sort().map(name => [name, fs.readFileSync(path.join(source, 'icons', name), 'utf8')]))
for (const definition of Object.values(theme.iconDefinitions)) {
  definition.iconPath = path.basename(definition.iconPath)
  if (!files[definition.iconPath]) throw new Error(`Missing icon: ${definition.iconPath}`)
}
// Keep alternate packs and unassociated icons available in the complete gallery.
const mapped = new Set(Object.values(theme.iconDefinitions).map(icon => icon.iconPath))
for (const name of Object.keys(files)) if (!mapped.has(name)) theme.iconDefinitions[`asset-${name.slice(0, -4)}`] = { iconPath: name }
const destination = path.join(root, 'resources/file-icons')
fs.writeFileSync(path.join(destination, 'material.json.gz'), zlib.gzipSync(JSON.stringify(files), { level: 9 }))
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(destination, 'material.LICENSE'))
fs.writeFileSync(path.join(root, 'src/renderer/src/features/file-icons/material.json'), JSON.stringify(theme))
const provenance = JSON.parse(fs.readFileSync(path.join(destination, 'sources.json'), 'utf8'))
provenance.material = { repository: 'https://github.com/material-extensions/vscode-material-icon-theme', version: JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).version, assets: Object.keys(files).length, sha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex') }
fs.writeFileSync(path.join(destination, 'sources.json'), JSON.stringify(provenance, null, 2) + '\n')
console.log(provenance.material)
