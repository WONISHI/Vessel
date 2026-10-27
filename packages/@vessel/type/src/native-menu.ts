export interface PdfExportOptions {
  paper: "A4" | "A3" | "A5" | "Letter" | "Legal"
  landscape: boolean
  marginMm: number
  fontSize: number
  printBackground: boolean
  pageNumbers: boolean
}

export type FileMenuCommand = "new" | "open" | "workspace" | "save" | "save-as" | "export-markdown" | "export-pdf" | "close-tab"
export interface FileMenuState {
  canCreate: boolean
  hasDocument: boolean
  canSave: boolean
  canExport: boolean
  recent: { name: string; path: string; kind: "file" | "workspace" }[]
}
export interface NativeMenuAPI {
  onFileMenuCommand: (callback: (command: FileMenuCommand | "recent", path?: string, kind?: "file" | "workspace") => void) => () => void
  updateFileMenu: (state: FileMenuState) => void
  fileMenuDialog: (request: { action: "open" | "save" | "pdf"; defaultPath?: string; content?: string; html?: string; markdown?: boolean; pdfOptions?: PdfExportOptions }) => Promise<string | null>
}
