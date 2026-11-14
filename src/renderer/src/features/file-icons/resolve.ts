import catppuccin from "./catppuccin.json"
import symbols from "./symbols.json"
export type FileIconTheme = "default" | "catppuccin" | "symbols"
export type CatppuccinFlavor = "auto" | "latte" | "frappe" | "macchiato" | "mocha"
type Associations = { file?: string; folder?: string; folderExpanded?: string; rootFolder?: string; rootFolderExpanded?: string; fileNames?: Record<string, string>; fileExtensions?: Record<string, string>; languageIds?: Record<string, string>; folderNames?: Record<string, string>; folderNamesExpanded?: Record<string, string>; rootFolderNames?: Record<string, string>; rootFolderNamesExpanded?: Record<string, string> }
type IconTheme = Associations & { light?: Associations; iconDefinitions: Record<string, { iconPath: string }> }
const themes: Record<"catppuccin" | "symbols", IconTheme> = { catppuccin, symbols }
for (const theme of Object.values(themes)) {
  for (const key of ["fileNames", "fileExtensions", "folderNames", "folderNamesExpanded", "rootFolderNames", "rootFolderNamesExpanded"] as const) {
    if (theme[key]) theme[key] = Object.fromEntries(Object.entries(theme[key]!).map(([name, icon]) => [name.toLowerCase(), icon]))
  }
}
const languages: Record<string, string> = { ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact", mjs: "javascript", cjs: "javascript", md: "markdown", mdx: "mdx", py: "python", sh: "shellscript", bash: "shellscript", rs: "rust", rb: "ruby", cs: "csharp", yml: "yaml", h: "c", hpp: "cpp", kt: "kotlin", ps1: "powershell", svg: "xml", m: "objective-c", mm: "objective-cpp", pl: "perl", tf: "terraform" }
function named(mapping: Record<string, string> | undefined, parts: string[]): string | undefined {
  if (!mapping) return undefined
  for (let i = 0; i < parts.length; i++) {
    const value = mapping[parts.slice(i).join("/")]
    if (value) return value
  }
  return undefined
}
export function resolveFileIcon(themeId: FileIconTheme, path: string, options: { directory?: boolean; expanded?: boolean; root?: boolean; dark?: boolean; languageId?: string } = {}): string | undefined {
  if (themeId === "default") return undefined
  const full = themes[themeId]
  const theme: Associations = options.dark === false && full.light ? { ...full, ...full.light } : full
  const parts = path.replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean)
  if (options.directory) {
    if (options.root) return (options.expanded && named(theme.rootFolderNamesExpanded, parts)) || named(theme.rootFolderNames, parts) || (options.expanded && theme.rootFolderExpanded) || theme.rootFolder || theme.folder
    return (options.expanded && named(theme.folderNamesExpanded, parts)) || named(theme.folderNames, parts) || (options.expanded && theme.folderExpanded) || theme.folder
  }
  const exact = named(theme.fileNames, parts)
  if (exact) return exact
  const suffixes = (parts.at(-1) || "").split(".")
  for (let i = 1; i < suffixes.length; i++) {
    const value = theme.fileExtensions?.[suffixes.slice(i).join(".")]
    if (value) return value
  }
  const extension = suffixes.at(-1) || ""
  return theme.languageIds?.[options.languageId || languages[extension] || extension] || theme.file
}
export function fileIconURL(theme: FileIconTheme, icon: string, flavor: CatppuccinFlavor = "auto", dark = false): string | undefined {
  if (theme === "default") return undefined
  const definition = themes[theme].iconDefinitions[icon]
  if (!definition) return undefined
  const variant = flavor === "auto" ? dark ? "mocha" : "latte" : flavor
  return `${import.meta.env.BASE_URL}vendor/file-icons/${theme}/${theme === "catppuccin" ? `${variant}/` : ""}${definition.iconPath}`
}
export function fileIconNames(theme: FileIconTheme): string[] {
  if (theme === "default") return []
  const seen = new Set<string>()
  return Object.keys(themes[theme].iconDefinitions).sort().filter((name) => {
    const path = themes[theme].iconDefinitions[name].iconPath
    if (seen.has(path)) return false
    seen.add(path)
    return true
  })
}
