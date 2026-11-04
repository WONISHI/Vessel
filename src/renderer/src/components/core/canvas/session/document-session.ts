import type { editor } from "monaco-editor"

export type MarkdownView = { top: number; left: number; anchor?: number; focus?: number }
type Session = { draft?: string; pending?: Promise<void>; error?: string; markdown?: MarkdownView; code?: editor.ICodeEditorViewState | null }
const sessions = new Map<string, Session>()

/** Retain only lightweight views and unsaved text, never editor instances or DOM ranges. */
export function documentSession(path: string): Session {
  let session = sessions.get(path)
  if (!session) { session = {}; sessions.set(path, session) }
  else { sessions.delete(path); sessions.set(path, session) }
  for (const [key, value] of sessions) {
    if (sessions.size <= 100) break
    if (key !== path && value.draft === undefined && !value.pending) sessions.delete(key)
  }
  return session
}

export function writeDocument(path: string, content: string): Promise<void> {
  const session = documentSession(path)
  session.draft = content
  session.error = undefined
  let write: Promise<void>
  try { write = window.electronAPI.saveContent(path, content) } catch (error) { write = Promise.reject(error) }
  session.pending = write
  void write.then(() => {
    if (session.pending === write) { session.pending = undefined; session.draft = undefined }
  }, (error) => { if (session.pending === write) { session.pending = undefined; session.error = String(error) } })
  return write
}

export async function waitForDocumentWrites(path: string): Promise<void> {
  const session = documentSession(path)
  while (session.pending) await session.pending
}

/** Reopening must wait for an in-flight save; failed saves reopen the recoverable draft. */
export async function readDocument(path: string): Promise<string> {
  const session = documentSession(path)
  while (session.pending) { try { await session.pending } catch { break } }
  return session.draft ?? window.electronAPI.readContent(path)
}
