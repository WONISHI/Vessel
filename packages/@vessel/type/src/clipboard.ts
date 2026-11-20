export type ClipboardKind = "text" | "image" | "link" | "color" | "files"
export type ClipboardFilter = { query?: string; kind?: ClipboardKind; pinnedOnly?: boolean }
export type ClipboardEntry = {
  id: number
  kind: ClipboardKind
  preview: string
  thumbnail?: string
  files: string[]
  createdAt: number
  pinned: boolean
  size: number
  characters: number
}
export type ClipboardState = {
  entries: ClipboardEntry[]
  total: number
  paused: boolean
  keepOpen: boolean
  shortcut: string
  shortcutRegistered: boolean
}
export interface ClipboardHistoryAPI {
  state(filter?: ClipboardFilter): Promise<ClipboardState>
  copy(id: number, plainText?: boolean): Promise<void>
  paste(id: number, plainText?: boolean): Promise<void>
  pin(id: number): Promise<void>
  remove(id: number): Promise<void>
  clear(): Promise<void>
  pause(paused: boolean): Promise<void>
  keepOpen(value: boolean): Promise<void>
  close(): Promise<void>
  onChange(callback: () => void): () => void
  onShow(callback: () => void): () => void
}
