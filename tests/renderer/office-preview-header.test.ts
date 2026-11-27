import { afterEach, expect, it, vi } from 'vitest'
import { configureOfficePreviewHeader } from '@/features/office/preview-header'

afterEach(() => vi.unstubAllGlobals())

it('uses compact headers while retaining the SDK configuration and constructor behavior', () => {
  const received = vi.fn()
  class Editor {
    constructor(...args: unknown[]) { received(...args) }
  }
  const api = { DocEditor: Editor }
  vi.stubGlobal('DocsAPI', api)
  const options = { document: { title: 'sheet.xlsx' }, editorConfig: { lang: 'zh', customization: { uiTheme: 'theme-dark', features: { spellcheck: false } } }, events: { onReady: vi.fn() } }
  configureOfficePreviewHeader()
  const wrapped = api.DocEditor
  configureOfficePreviewHeader()
  expect(api.DocEditor).toBe(wrapped)
  expect(new api.DocEditor('placeholder', options)).toBeInstanceOf(Editor)
  expect(received).toHaveBeenCalledExactlyOnceWith('placeholder', {
    ...options, editorConfig: { ...options.editorConfig, customization: { ...options.editorConfig.customization, compactHeader: true } }
  })
  expect(options.editorConfig.customization).not.toHaveProperty('compactHeader')
})
