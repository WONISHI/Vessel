import type { WorkspaceContextType } from '@/components/workspace/types/workspace'
import { disposeUnusedCodeModel } from '@/components/core/canvas/session/code-model'
import { readDocument } from '@/components/core/canvas/session/document-session'
import { codeLanguage } from './language'
import { monaco } from './monaco'
import { codeEditors } from './search-bridge'
import { toast } from 'sonner'

const pendingPositions = new Map<string, monaco.IPosition>()

export function revealCodeDefinition(path: string, editor: monaco.editor.IStandaloneCodeEditor) {
  const position = pendingPositions.get(path)
  if (!position) return
  pendingPositions.delete(path)
  editor.setPosition(position)
  editor.revealPositionInCenter(position)
  editor.focus()
}

/** Monaco supplies F12, Cmd/Ctrl-click, underlining, peek and the definition context menu. */
export function registerCodeNavigation(editor: monaco.editor.IStandaloneCodeEditor, workspace: WorkspaceContextType) {
  const source = editor.getModel()
  if (!source || !/\.(vue|[cm]?[jt]sx?)$/i.test(source.uri.fsPath)) return { dispose() { /* This file has no project definition provider. */ } }
  let disposed = false
  let cached: { key: string; at: number; value: Promise<monaco.languages.Location[]> } | undefined
  const previews = new Set<monaco.editor.ITextModel>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const definitions = monaco.languages.registerDefinitionProvider(source.getLanguageId(), {
    async provideDefinition(model, position, token) {
      if (disposed || model !== source) return []
      const key = `${model.getVersionId()}:${model.getOffsetAt(position)}`
      if (cached?.key !== key || Date.now() - cached.at > 500) {
        const value = window.electronAPI.getCodeDefinitions({ path: model.uri.fsPath, content: model.getValue(), offset: model.getOffsetAt(position) }).then(async results => {
          const locations: monaco.languages.Location[] = []
          for (const result of results) {
            if (disposed) break
            const uri = monaco.Uri.file(result.path)
            if (!monaco.editor.getModel(uri)) {
              const text = await readDocument(result.path)
              if (disposed) break
              if (!monaco.editor.getModel(uri)) {
                const preview = monaco.editor.createModel(text, codeLanguage(result.path) || 'plaintext', uri)
                previews.add(preview)
                const timer = setTimeout(() => { timers.delete(timer); disposeUnusedCodeModel(preview); previews.delete(preview) }, 60_000)
                timers.add(timer)
              }
            }
            locations.push({ uri, range: new monaco.Range(result.lineNumber, result.column, result.endLineNumber, result.endColumn) })
          }
          return locations
        }).catch(error => { if (!disposed && !token.isCancellationRequested) toast.error('查询代码定义失败', { description: String(error) }); return [] })
        cached = { key, at: Date.now(), value }
      }
      const locations = await cached.value
      return disposed || token.isCancellationRequested ? [] : locations
    }
  })
  const opener = monaco.editor.registerEditorOpener({
    openCodeEditor(origin, resource, selection) {
      if (origin !== editor || resource.scheme !== 'file') return false
      const path = resource.fsPath
      const position = selection && 'startLineNumber' in selection ? { lineNumber: selection.startLineNumber, column: selection.startColumn } : selection || { lineNumber: 1, column: 1 }
      pendingPositions.set(path, position)
      workspace.openWorkspaceFile({ path, name: path.split(/[\\/]/).pop() || path, type: 'file' })
      const existing = codeEditors.get(path)
      if (existing) { existing.setPosition(position); existing.revealLineInCenter(position.lineNumber); existing.focus() }
      return true
    }
  })
  return { dispose() {
    disposed = true
    definitions.dispose()
    opener.dispose()
    for (const timer of timers) clearTimeout(timer)
    // The destination can mount on the next React commit; defer cleanup until it retains the model.
    setTimeout(() => { for (const preview of previews) disposeUnusedCodeModel(preview) }, 1000)
  } }
}
