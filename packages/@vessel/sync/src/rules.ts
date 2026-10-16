export type SyncEntryKind = "file" | "folder"
export interface SyncExcludeRules {
  file: string[]
  folder: string[]
}
/** {file:a,b},{folder:d} and {file:a,b;folder:d} share the same grammar. */
export function parseSyncExcludeRules(input = ""): SyncExcludeRules {
  if (typeof input !== "string") throw new Error("同步排除规则必须是文本")
  const result: SyncExcludeRules = { file: [], folder: [] }
  let cursor = 0,
    groups = 0

  /** Performs the invalid operation. */
  const invalid = () => new Error(`同步排除规则格式无效（位置 ${cursor + 1}），示例：{file:a,b;folder:d}`)
  while (cursor < input.length) {
    while (/\s/.test(input[cursor] ?? "") && cursor < input.length) cursor++
    if (cursor === input.length) break
    if (groups && input[cursor] === ",") {
      cursor++
      while (/\s/.test(input[cursor] ?? "") && cursor < input.length) cursor++
      if (cursor === input.length) throw invalid()
    }
    if (input[cursor] !== "{") throw invalid()
    const end = input.indexOf("}", cursor + 1)
    if (end === -1 || input.slice(cursor + 1, end).includes("{")) throw invalid()
    const body = input.slice(cursor + 1, end)
    for (const section of body.split(";")) {
      const match = /^\s*(file|folder)\s*:\s*(.+?)\s*$/i.exec(section)
      if (!match) throw invalid()
      const kind = match[1].toLowerCase() as SyncEntryKind
      const names = match[2].split(",").map((name) => name.trim().replaceAll("\\", "/"))
      if (names.some((name) => !name || /[{};:\0]/.test(name) || name.startsWith("/") || name.split("/").some((part) => !part || part === "." || part === ".."))) throw invalid()
      result[kind].push(...names)
    }
    cursor = end + 1
    groups++
  }
  return { file: [...new Set(result.file)], folder: [...new Set(result.folder)] }
}

/** Performs the glob operation. */
const glob = (pattern: string) =>
  new RegExp(
    "^" +
      pattern
        .split("")
        .map((character) => (character === "*" ? "[^/]*" : character === "?" ? "[^/]" : character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .join("") +
      "$"
  )
/** Bare patterns match names at any depth; slash patterns match workspace-relative paths. */
export function createSyncExcludeFilter(input: string | SyncExcludeRules = "") {
  const rules = typeof input === "string" ? parseSyncExcludeRules(input) : input

  /** Performs the compile operation. */
  const compile = (patterns: string[]) => patterns.map((pattern) => ({ path: pattern.includes("/"), regex: glob(pattern) }))
  const files = compile(rules.file),
    folders = compile(rules.folder)
  return (path: string, kind: SyncEntryKind = "file") => {
    const segments = path.replaceAll("\\", "/").split("/")
    const folderCount = kind === "folder" ? segments.length : segments.length - 1
    for (let index = 0; index < folderCount; index++) {
      const relative = segments.slice(0, index + 1).join("/")
      if (folders.some((rule) => rule.regex.test(rule.path ? relative : segments[index]))) return true
    }
    return kind === "file" && files.some((rule) => rule.regex.test(rule.path ? segments.join("/") : segments.at(-1)!))
  }
}
