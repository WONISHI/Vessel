/** The same folders-first ordering used by the changes tree. */
export function compareGitTreeNames(left: string, leftDirectory: boolean, right: string, rightDirectory: boolean): number {
  if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1
  return left.localeCompare(right, 'zh-CN', { numeric: true })
}

/** Count files (never folder rows); tree positions follow the displayed directory ordering. */
export function gitFilePosition(files: { path: string }[], selectedPath: string | undefined, tree = false): string {
  const ordered = tree ? [...files].sort((left, right) => {
    const a = left.path.replace(/\\/g, '/').split('/')
    const b = right.path.replace(/\\/g, '/').split('/')
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const order = compareGitTreeNames(a[i], i < a.length - 1, b[i], i < b.length - 1)
      if (order) return order
    }
    return 0
  }) : files
  const index = selectedPath ? ordered.findIndex(file => file.path === selectedPath) : -1
  return `${index + 1}/${files.length}`
}
