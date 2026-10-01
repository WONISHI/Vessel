export type FileChange = { path: string; type: "create" | "update" | "delete" }
export interface FileWatchAPI {
  watchStart(root: string): Promise<string>
  watchStop(id: string): Promise<void>
  onFilesChanged(callback: (root: string, changes: FileChange[], error?: string) => void): () => void
}
