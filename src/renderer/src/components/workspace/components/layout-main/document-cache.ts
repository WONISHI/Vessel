import { createContext } from "react"
export const WorkspaceVisible = createContext(true)
export const DOCUMENT_CACHE_LIMIT = 3
export const BACKGROUND_RELEASE_MS = 30_000

/** Office and drawing editors may contain changes that have not reached disk. */
export function canEvictDocument(path: string) {
  return !/\.(?:docx?|docs|xlsx?|pptx?|odt|ods|odp|canvas|excalidraw|mind|base|markdowntable)$/i.test(path) && !/\.excalidraw\.md$/i.test(path)
}
