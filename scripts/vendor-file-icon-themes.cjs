// Re-import official theme data and every SVG without running upstream extension code.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto'), ts = require('typescript')
const [cat, symbols] = process.argv.slice(2)
if (!cat || !symbols) throw new Error('Usage: node scripts/vendor-file-icon-themes.cjs <catppuccin-root> <symbols-root>')
const root = path.resolve(__dirname, '..')
function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal)
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
    if (!ts.isPropertyAssignment(p)) throw new Error('Unexpected association syntax')
    return [p.name.text, literal(p.initializer)]
  }))
  throw new Error(`Unexpected literal: ${node.getText().slice(0, 80)}`)
}
function readLiteral(file, variable) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let value
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === variable) value = literal(node.initializer); ts.forEachChild(node, visit) }
  visit(source)
  if (!value) throw new Error(`Missing ${variable}`)
  return value
}
function filesAt(directory, relative = '') {
  return Object.assign({}, ...fs.readdirSync(directory, { withFileTypes: true }).map(entry => {
    const name = path.posix.join(relative, entry.name), file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesAt(file, name) : entry.name.endsWith('.svg') ? { [name]: fs.readFileSync(file, 'utf8') } : {}
  }))
}
function save(id, sourceRoot, files, theme) {
  const destination = path.join(root, 'resources/file-icons')
  fs.writeFileSync(path.join(destination, `${id}.json.gz`), zlib.gzipSync(JSON.stringify(files), { level: 9 }))
  fs.copyFileSync(path.join(sourceRoot, 'LICENSE'), path.join(destination, `${id}.LICENSE`))
  fs.writeFileSync(path.join(root, `src/renderer/src/features/file-icons/${id}.json`), JSON.stringify(theme))
  return { version: JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'))).version, assets: Object.keys(files).length, sha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex') }
}
const catFiles = filesAt(path.join(cat, 'icons'))
const fileIcons = readLiteral(path.join(cat, 'src/defaults/fileIcons.ts'), 'fileIcons')
const folderIcons = readLiteral(path.join(cat, 'src/defaults/folderIcons.ts'), 'folderIcons')
const associations = { fileExtensions: {}, fileNames: {}, languageIds: {}, folderNames: {}, folderNamesExpanded: {} }
for (const [icon, mapping] of Object.entries(fileIcons)) for (const kind of ['fileExtensions', 'fileNames', 'languageIds']) for (const name of mapping[kind] || []) associations[kind][name] = icon
for (const [icon, mapping] of Object.entries(folderIcons)) for (const name of mapping.folderNames || []) { associations.folderNames[name] = `folder_${icon}`; associations.folderNamesExpanded[name] = `folder_${icon}_open` }
const definitions = Object.fromEntries(Object.keys(catFiles).filter(name => name.startsWith('mocha/')).map(name => [path.basename(name, '.svg'), { iconPath: path.basename(name) }]))
const catTheme = { file: '_file', folder: '_folder', folderExpanded: '_folder_open', rootFolder: '_root', rootFolderExpanded: '_root_open', ...associations, iconDefinitions: definitions }
const symbolsFiles = filesAt(path.join(symbols, 'src/icons'))
const symbolsTheme = JSON.parse(fs.readFileSync(path.join(symbols, 'src/symbol-icon-theme.json'), 'utf8'))
for (const definition of Object.values(symbolsTheme.iconDefinitions)) definition.iconPath = definition.iconPath.replace(/^\.\/icons\//, '')
const mappedPaths = new Set(Object.values(symbolsTheme.iconDefinitions).map(icon => icon.iconPath))
for (const iconPath of Object.keys(symbolsFiles)) if (!mappedPaths.has(iconPath)) {
  const basename = path.basename(iconPath, '.svg')
  symbolsTheme.iconDefinitions[basename in symbolsTheme.iconDefinitions ? `extra-${basename}` : basename] = { iconPath }
}
symbolsTheme.folderExpanded = 'folder-open' 
for (const [theme, files, prefix] of [[catTheme, catFiles, 'mocha/'], [symbolsTheme, symbolsFiles, '']]) {
  for (const definition of Object.values(theme.iconDefinitions)) if (!(prefix + definition.iconPath in files)) throw new Error(`Missing ${definition.iconPath}`)
}
const provenance = {
  catppuccin: { repository: 'https://github.com/catppuccin/vscode-icons', ...save('catppuccin', cat, catFiles, catTheme) },
  symbols: { repository: 'https://github.com/miguelsolorio/vscode-symbols', ...save('symbols', symbols, symbolsFiles, symbolsTheme) }
}
fs.writeFileSync(path.join(root, 'resources/file-icons/sources.json'), JSON.stringify(provenance, null, 2) + '\n')
console.log(provenance)
