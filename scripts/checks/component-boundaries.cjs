const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

/** Performs the contains jsx operation. */
function containsJsx(node) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true
  return !!ts.forEachChild(node, containsJsx)
}

/** Checks directory. */
function checkDirectory(directory) {
  let failures = 0
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "public"].includes(entry.name)) continue
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      failures += checkDirectory(filename)
      continue
    }
    if (!/\.[jt]sx$/.test(entry.name)) continue
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const components = source.statements.filter((statement) => (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement) || ts.isClassDeclaration(statement)) && containsJsx(statement))
    if (components.length > 1) {
      console.error(`${filename}: ${components.length} JSX declarations; extract components into components/`)
      failures++
    }
  }
  return failures
}
const failures = checkDirectory("src") + checkDirectory("packages/@vessel")
if (failures) process.exitCode = 1
else console.log("Component boundaries verified: one JSX declaration per module.")
