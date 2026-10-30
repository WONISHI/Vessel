const pending = new Map<string, Promise<void>>()

/** Track saves before watcher events can read a transient version of the same file. */
export function saveMarkdownContent(path: string, content: string): Promise<void> {
  const write = window.electronAPI.saveContent(path, content)
  pending.set(path, write)
  const clear = () => { if (pending.get(path) === write) pending.delete(path) }
  void write.then(clear, clear)
  return write
}

/** New saves can arrive while awaiting an earlier one; wait through the entire current batch. */
export async function waitForMarkdownWrites(path: string): Promise<void> {
  while (pending.has(path)) await pending.get(path)!
}
