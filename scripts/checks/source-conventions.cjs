const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

/** Lists maintained source files while excluding generated and installed assets. */
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", "public"].includes(entry.name)) return []
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(filename) : /\.[cm]?[jt]sx?$/.test(filename) ? [filename] : []
  })
}

/** Identifies named callback wrappers that retain a callable function value. */
function callable(initializer, source) {
  if (!initializer) return false
  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return true
  return ts.isCallExpression(initializer) && /^(?:React\.)?(?:forwardRef|memo|useCallback)$/.test(initializer.expression.getText(source)) && initializer.arguments.some((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
}

/** Checks source imports, route-component placement and named function documentation. */
function checkSource(filename) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const errors = []
  const declarationFile = filename.endsWith(".d.ts")
  const testFile = filename.startsWith("tests/") || filename.includes("/tests/")
  if (filename.startsWith("src/renderer/src/pages/") && filename.endsWith(".tsx") && !filename.includes("/components/") && !filename.endsWith("/index.tsx")) errors.push("Non-route components must be placed in the owning route's components directory")

  /** Reports an undocumented named implementation without requiring comments on anonymous callbacks. */
  function documented(node) {
    if (!declarationFile && !testFile && !node.jsDoc?.length) errors.push(`Missing JSDoc at line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`)
  }

  /** Visits actual module imports; URLs and code injected into external web pages retain their own semantics. */
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith(".")) errors.push(`Relative module import: ${node.moduleSpecifier.text}`)
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require" || /^vi\.(mock|doMock|unmock|importActual)$/.test(node.expression.getText(source)))) {
      const argument = node.arguments[0]
      if (argument && ts.isStringLiteral(argument) && argument.text.startsWith(".")) errors.push(`Relative module import: ${argument.text}`)
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal) && node.argument.literal.text.startsWith(".")) errors.push(`Relative type import: ${node.argument.literal.text}`)
    if (ts.isFunctionDeclaration(node) && node.body && node.name) documented(node)
    if ((ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isConstructorDeclaration(node)) && node.body) documented(node)
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => callable(declaration.initializer, source))) documented(node)
    if ((ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) && callable(node.initializer, source)) documented(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const error of errors) console.error(`${filename}: ${error}`)
  return errors.length
}

let failures = 0
for (const directory of ["src", "packages/@vessel", "scripts", "tests"]) {
  for (const filename of sourceFiles(directory)) failures += checkSource(filename)
}
for (const directory of fs.readdirSync("packages/@vessel")) {
  const metadata = JSON.parse(fs.readFileSync(`packages/@vessel/${directory}/package.json`, "utf8"))
  if (metadata.name !== `@vessel/${directory}`) {
    console.error(`Workspace name does not match packages/@vessel/${directory}`)
    failures++
  }
}
if (failures) process.exitCode = 1
else console.log("Verified aliases, route ownership, workspace names and named function JSDoc.")
