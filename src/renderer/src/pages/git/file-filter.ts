/** Match all keyword fragments against the relative filename/path, ignoring case. */
export function matchesGitFilePath(path: string, query: string) {
  const normalized = path.replace(/\\/g, "/").toLocaleLowerCase()
  return query.trim().toLocaleLowerCase().replace(/\\/g, "/").split(/\s+/).every(part => normalized.includes(part))
}
