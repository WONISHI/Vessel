export interface TerminalAPI {
  terminalStart(root: string, file?: string): Promise<{ id: string; cwd: string }>
  terminalWrite(id: string, data: string): Promise<void>
  terminalResize(id: string, cols: number, rows: number): Promise<void>
  terminalClose(id: string): Promise<void>
  onTerminalData(callback: (id: string, data: string) => void): () => void
}
