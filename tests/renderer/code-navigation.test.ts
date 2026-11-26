import { beforeEach, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ provider: undefined as any, opener: undefined as any, models: new Map(), open: vi.fn(), dispose: vi.fn(), read: vi.fn(), errors: vi.fn(), definitions: vi.fn() }))
vi.mock('@/components/core/canvas/variants/code/monaco', () => ({ monaco: {
  Uri: { file: (path: string) => ({ fsPath: path, scheme: 'file' }) },
  Range: class { constructor(public startLineNumber: number, public startColumn: number, public endLineNumber: number, public endColumn: number) {} },
  languages: { registerDefinitionProvider: (_: string, provider: any) => { harness.provider = provider; return { dispose: harness.dispose } } },
  editor: {
    registerEditorOpener: (opener: any) => { harness.opener = opener; return { dispose: harness.dispose } },
    getModel: (uri: any) => harness.models.get(uri.fsPath),
    createModel: (text: string, _: string, uri: any) => { const model = { text, isDisposed: () => false, dispose: vi.fn() }; harness.models.set(uri.fsPath, model); return model }
  }
} }))
vi.mock('@/components/core/canvas/session/document-session', () => ({ readDocument: harness.read }))
vi.mock('@/components/core/canvas/session/code-model', () => ({ disposeUnusedCodeModel: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: harness.errors } }))
import { registerCodeNavigation, revealCodeDefinition } from '@/components/core/canvas/variants/code/navigation'

beforeEach(() => {
  vi.useFakeTimers()
  harness.models.clear(); vi.clearAllMocks()
  Object.assign(window, { electronAPI: { getCodeDefinitions: harness.definitions } })
})

it('opens the real workspace tab and restores the definition cursor after mounting', async () => {
  const model = { uri: { fsPath: '/project/App.vue' }, getLanguageId: () => 'html', getVersionId: () => 1, getOffsetAt: () => 4, getValue: () => 'draft' }
  const editor = { getModel: () => model } as any
  harness.definitions.mockResolvedValue([{ path: '/project/Child.vue', lineNumber: 8, column: 3, endLineNumber: 8, endColumn: 10 }])
  harness.read.mockResolvedValue('child current draft')
  const subscription = registerCodeNavigation(editor, { openWorkspaceFile: harness.open } as any)
  expect(await harness.provider.provideDefinition(model, {}, { isCancellationRequested: false })).toHaveLength(1)
  expect(harness.definitions).toHaveBeenCalledWith({ path: '/project/App.vue', content: 'draft', offset: 4 })
  expect(harness.models.get('/project/Child.vue').text).toBe('child current draft')
  expect(harness.opener.openCodeEditor(editor, { scheme: 'file', fsPath: '/project/Child.vue' }, { startLineNumber: 8, startColumn: 3 })).toBe(true)
  expect(harness.open).toHaveBeenCalledWith({ path: '/project/Child.vue', name: 'Child.vue', type: 'file' })
  const destination = { setPosition: vi.fn(), revealPositionInCenter: vi.fn(), focus: vi.fn() } as any
  revealCodeDefinition('/project/Child.vue', destination)
  expect(destination.setPosition).toHaveBeenCalledWith({ lineNumber: 8, column: 3 })
  expect(destination.focus).toHaveBeenCalledOnce()
  subscription.dispose(); vi.runAllTimers(); vi.useRealTimers()
})

it('ignores other editors and cancels stale definition results after unmounting', async () => {
  const model = { uri: { fsPath: '/project/App.ts' }, getLanguageId: () => 'typescript', getVersionId: () => 1, getOffsetAt: () => 2, getValue: () => 'draft' }
  const editor = { getModel: () => model } as any
  let finish!: (value: any[]) => void
  harness.definitions.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const subscription = registerCodeNavigation(editor, { openWorkspaceFile: harness.open } as any)
  expect(harness.opener.openCodeEditor({}, { scheme: 'file', fsPath: '/other.ts' })).toBe(false)
  const request = harness.provider.provideDefinition(model, {}, { isCancellationRequested: false })
  subscription.dispose()
  finish([{ path: '/project/Child.ts', lineNumber: 1, column: 1, endLineNumber: 1, endColumn: 1 }])
  expect(await request).toEqual([])
  expect(harness.read).not.toHaveBeenCalled()
  vi.runAllTimers(); vi.useRealTimers()
})
