import type { JsonShareInfo } from '@vessel/type'
import type { editor } from 'monaco-editor'

export type JsonDocument = {
  id: string
  name: string
  value: string
  error: string
  view: editor.ICodeEditorViewState | null
  share: JsonShareInfo | null
}

/** Window-local drafts survive tool navigation; they are never written to disk. */
export const jsonDocuments = {
  items: [{ id: 'default', name: 'JSON 1', value: '', error: '', view: null, share: null }] as JsonDocument[],
  activeId: 'default',
  nextNumber: 2
}

export function createJsonDocument(): JsonDocument {
  return { id: crypto.randomUUID(), name: `JSON ${jsonDocuments.nextNumber++}`, value: '', error: '', view: null, share: null }
}

export const jsonDocumentUri = (id: string) => `inmemory://vessel-json/${id}.json`

export function activateJsonDocument(id: string) { jsonDocuments.activeId = id }

export function addJsonDocument(): JsonDocument {
  const document = createJsonDocument()
  jsonDocuments.items.push(document)
  activateJsonDocument(document.id)
  return document
}

export function updateJsonDocument(id: string, patch: Partial<Omit<JsonDocument, 'id'>>) {
  const document = jsonDocuments.items.find(item => item.id === id)
  if (document) Object.assign(document, patch)
}

export function removeJsonDocument(id: string) {
  const index = jsonDocuments.items.findIndex(item => item.id === id)
  jsonDocuments.items = jsonDocuments.items.filter(item => item.id !== id)
  if (!jsonDocuments.items.length) jsonDocuments.items.push(createJsonDocument())
  if (jsonDocuments.activeId === id) activateJsonDocument(jsonDocuments.items[Math.min(index, jsonDocuments.items.length - 1)].id)
}
