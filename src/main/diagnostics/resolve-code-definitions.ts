import type { CodeDefinition, CodeDefinitionRequest } from '@vessel/type'
import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import ts from 'typescript'

/** Preserve every original offset so Vue script declarations reveal at the correct line. */
function scriptSource(path: string, text: string): string {
  if (!path.endsWith('.vue')) return text
  const characters = text.split('').map(character => /[\r\n]/.test(character) ? character : ' ')
  for (const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const start = match.index! + match[0].indexOf('>') + 1
    for (let i = 0; i < match[1].length; i++) characters[start + i] = match[1][i]
  }
  return characters.join('')
}

function compilerOptions(path: string): ts.CompilerOptions {
  const configPath = ts.findConfigFile(dirname(path), ts.sys.fileExists) || ts.findConfigFile(dirname(path), ts.sys.fileExists, 'jsconfig.json')
  const defaults = { allowJs: true, allowNonTsExtensions: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }
  if (!configPath) return defaults
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) return defaults
  const configHost: ts.ParseConfigHost = { ...ts.sys, readDirectory: (directory, extensions, excludes, includes, depth) => ts.sys.readDirectory(directory, [...(extensions || []), '.vue'], excludes, includes, depth) }
  let parsed = ts.parseJsonConfigFileContent(config.config, configHost, dirname(configPath), undefined, configPath)
  for (const reference of parsed.projectReferences || []) {
    const candidate = reference.path.endsWith('.json') ? reference.path : join(reference.path, 'tsconfig.json')
    const raw = ts.readConfigFile(candidate, ts.sys.readFile)
    if (raw.error) continue
    const sub = ts.parseJsonConfigFileContent(raw.config, configHost, dirname(candidate), undefined, candidate)
    if (sub.fileNames.includes(path)) { parsed = sub; break }
  }
  return { ...defaults, ...parsed.options, allowNonTsExtensions: true }
}

function resolveImport(name: string, path: string, options: ts.CompilerOptions): string | undefined {
  const resolved = ts.resolveModuleName(name, path, options, ts.sys).resolvedModule?.resolvedFileName
  if (resolved) return resolved
  const candidates: string[] = []
  if (name.startsWith('.') || isAbsolute(name)) candidates.push(resolve(dirname(path), name))
  for (const [alias, targets] of Object.entries(options.paths || {})) {
    const [prefix, suffix = ''] = alias.split('*')
    if (alias.includes('*') ? name.startsWith(prefix) && name.endsWith(suffix) : name === alias) {
      const middle = alias.includes('*') ? name.slice(prefix.length, name.length - suffix.length) : ''
      for (const target of targets) candidates.push(resolve(options.baseUrl || options.pathsBasePath as string || dirname(path), target.replace('*', middle)))
    }
  }
  if (options.baseUrl) candidates.push(resolve(options.baseUrl, name))
  for (const candidate of candidates) {
    for (const suffix of ['', '.vue', '.ts', '.tsx', '.js', '.jsx', '/index.vue', '/index.ts', '/index.js']) {
      if (ts.sys.fileExists(candidate + suffix)) return candidate + suffix
    }
  }
  return undefined
}

/** TypeScript resolves lexical scopes, aliases, exports and members; Vue templates reuse script bindings. */
export function resolveCodeDefinitions({ path, content, offset }: CodeDefinitionRequest): CodeDefinition[] {
  const options = compilerOptions(path)
  const transformed = scriptSource(path, content)
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [path],
    getScriptVersion: () => '0',
    getScriptKind: filename => filename.endsWith('.jsx') ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(filename) ? ts.ScriptKind.JS : filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    getScriptSnapshot: filename => {
      const text = filename === path ? content : ts.sys.readFile(filename)
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(scriptSource(filename, text))
    },
    getCurrentDirectory: () => dirname(path),
    getDefaultLibFileName: settings => ts.getDefaultLibFilePath(settings),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    resolveModuleNames: (names, containingFile) => names.map(name => {
      const filename = resolveImport(name, containingFile, options)
      return filename ? { resolvedFileName: filename, extension: filename.endsWith('.vue') ? ts.Extension.Ts : (filename.endsWith('.d.ts') ? ts.Extension.Dts : extname(filename)) as ts.Extension } : undefined
    })
  }
  const service = ts.createLanguageService(host)
  try {
    const source = service.getProgram()?.getSourceFile(path)
    if (!source) return []
    const location = (filename: string, start = 0, length = 0): CodeDefinition[] => {
      const text = filename === path ? content : ts.sys.readFile(filename)
      if (text === undefined) return []
      const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest)
      const first = file.getLineAndCharacterOfPosition(Math.min(start, text.length))
      const last = file.getLineAndCharacterOfPosition(Math.min(start + length, text.length))
      return [{ path: filename, lineNumber: first.line + 1, column: first.character + 1, endLineNumber: last.line + 1, endColumn: last.character + 1 }]
    }
    // Module strings and Vue component imports lead to the actual source file, not a synthetic declaration.
    const moduleTarget = (node: ts.Node): string | undefined => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? resolveImport(node.moduleSpecifier.text, path, options) : undefined
      if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) return resolveImport(node.arguments[0].text, path, options)
      return undefined
    }
    let importPath: string | undefined
    const inspect = (node: ts.Node) => {
      if (offset < node.getStart(source) || offset > node.end) return
      const target = moduleTarget(node)
      if (target && (ts.isCallExpression(node) ? node.arguments : node.getChildren(source)).some(child => ts.isStringLiteral(child) && offset >= child.getStart(source) && offset <= child.end)) importPath = target
      ts.forEachChild(node, inspect)
    }
    inspect(source)
    if (importPath) return location(importPath)

    let position = offset
    const wordStart = offset - (content.slice(0, offset).match(/[\w$-]*$/)?.[0].length || 0)
    if (path.endsWith('.vue') && transformed.slice(wordStart, offset + 1).trim() === '' && /[\w$]/.test(content[wordStart] || '')) {
      const before = content.slice(0, offset).match(/[\w$-]*$/)?.[0] || ''
      const after = content.slice(offset).match(/^[\w$-]*/)?.[0] || ''
      const word = (before + after).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
      let binding: ts.Identifier | undefined
      // Only top-level script bindings are visible in the template; never guess nested locals.
      const collect = (node: ts.Node) => {
        if (ts.isIdentifier(node) && (node.text === word || node.text === word[0]?.toUpperCase() + word.slice(1))) binding = node
        if (ts.isImportDeclaration(node) || ts.isImportClause(node) || ts.isNamedImports(node) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isVariableStatement(node) || ts.isVariableDeclarationList(node) || ts.isBindingElement(node) || ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) ts.forEachChild(node, collect)
        else if (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) { if (node.name) collect(node.name) }
      }
      source.statements.forEach(collect)
      if (!binding) return []
      position = binding.getStart(source)
      let ancestor: ts.Node | undefined = binding
      while (ancestor && !ts.isImportDeclaration(ancestor)) ancestor = ancestor.parent
      if (ancestor) {
        const target = moduleTarget(ancestor)
        if (target?.endsWith('.vue')) return location(target)
      }
    }
    return (service.getDefinitionAtPosition(path, position) || []).flatMap(definition => location(definition.fileName, definition.textSpan.start, definition.textSpan.length))
  } finally {
    service.dispose()
  }
}
