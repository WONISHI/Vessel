const languages: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
  json: "json", jsonc: "json", html: "html", htm: "html", vue: "html", svelte: "html",
  css: "css", scss: "scss", sass: "scss", less: "less", py: "python",
  java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp",
  go: "go", rs: "rust", php: "php", rb: "ruby", swift: "swift", kt: "kotlin",
  sh: "shell", bash: "shell", zsh: "shell", ps1: "powershell", bat: "bat",
  sql: "sql", yaml: "yaml", yml: "yaml", xml: "xml", toml: "ini", ini: "ini",
  conf: "plaintext", env: "plaintext", txt: "plaintext", log: "plaintext", graphql: "graphql",
  r: "r", lua: "lua", dart: "dart", dockerfile: "dockerfile"
}
export function codeLanguage(path: string): string | undefined {
  const name = path.split(/[\\/]/).pop()?.toLowerCase() || ""
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile"
  if (name.startsWith(".env") || [".gitignore", ".npmrc", ".editorconfig", "makefile"].includes(name)) return "plaintext"
  return languages[name.split(".").pop() || ""]
}
