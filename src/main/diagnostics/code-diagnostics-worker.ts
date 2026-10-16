import type { CodeDiagnostic } from "@vessel/type"
import { dirname, join, resolve } from "node:path"
import { parentPort } from "node:worker_threads"
import ts from "typescript"

/** The worker uses the real project filesystem; Monaco's browser worker cannot read node_modules. */
export function diagnoseCode(path: string, content: string): CodeDiagnostic[] {
  const configPath = ts.findConfigFile(dirname(path), ts.sys.fileExists) || ts.findConfigFile(dirname(path), ts.sys.fileExists, "jsconfig.json")
  let options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: true,
    noEmit: true,
    skipLibCheck: true
  }
  let projectFiles = [path]
  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"))
    let effectiveConfig = config.config
    let effectiveConfigPath = configPath
    if (Array.isArray(config.config?.references)) {
      for (const ref of config.config.references) {
        const refRaw = typeof ref === "string" ? ref : ref?.path
        if (!refRaw) continue
        const candidate = resolve(dirname(configPath), refRaw.endsWith(".json") ? refRaw : join(refRaw, "tsconfig.json"))
        if (ts.sys.fileExists(candidate)) {
          const subConfig = ts.readConfigFile(candidate, ts.sys.readFile)
          if (!subConfig.error && subConfig.config) {
            const parsedSub = ts.parseJsonConfigFileContent(subConfig.config, ts.sys, dirname(candidate), undefined, candidate)
            if (parsedSub.fileNames.some((f) => resolve(f) === resolve(path))) {
              effectiveConfig = subConfig.config
              effectiveConfigPath = candidate
              break
            }
          }
        }
      }
    }
    const parsed = ts.parseJsonConfigFileContent(effectiveConfig, ts.sys, dirname(effectiveConfigPath), undefined, effectiveConfigPath)
    const errors = parsed.errors.filter((error) => error.code !== 18003)
    if (errors.length) throw new Error(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"))
    options = { ...parsed.options, noEmit: true }
    projectFiles = [...new Set([...parsed.fileNames, path])]
  }
  const host = ts.createCompilerHost(options)
  const read = host.readFile
  host.readFile = (filename) => (filename === path ? content : read(filename))
  const program = ts.createProgram(projectFiles, options, host)
  const source = program.getSourceFile(path)
  if (!source) return []
  return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].map((diagnostic) => {
    const start = source.getLineAndCharacterOfPosition(diagnostic.start || 0)
    const end = source.getLineAndCharacterOfPosition(Math.min(source.text.length, (diagnostic.start || 0) + (diagnostic.length || 1)))
    return {
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      code: diagnostic.code,
      severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "info",
      startLineNumber: start.line + 1,
      startColumn: start.character + 1,
      endLineNumber: end.line + 1,
      endColumn: end.character + 1
    }
  })
}
parentPort?.on("message", ({ id, path, content }: { id: number; path: string; content: string }) => {
  try {
    parentPort!.postMessage({ id, diagnostics: diagnoseCode(path, content) })
  } catch (error) {
    parentPort!.postMessage({ id, error: String(error) })
  }
})
