import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ contents: [] as any[] }))
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => mocks.contents }, BrowserWindow: { fromWebContents: () => ({ getTitle: () => 'Vessel', isVisible: () => true, isMinimized: () => false }), getAllWindows: () => [{}] } }))
vi.mock('@main/diagnostics/code-diagnostics', () => ({ getCodeDiagnosticsState: () => ({ running: false, pending: 0, queued: 0, queuedBytes: 0 }) }))
import { collectPerformanceSources, diagnosticUrl } from '@main/modules/welcome/performance-resources'
it('maps cross-process Office frames using OS PIDs rather than Chromium internal IDs', () => {
  const main = { osProcessId: 101, processId: 900, frameTreeNodeId: 1, url: 'file:///app/index.html#/debug/performance', parent: null, name: '' }
  const office = { osProcessId: 202, processId: 901, frameTreeNodeId: 2, url: 'http://127.0.0.1:8888/office.html?token=secret', parent: main, name: 'frameEditor' }
  mocks.contents = [{ id: 4, isDestroyed: () => false, getType: () => 'window', getTitle: () => '性能监控', mainFrame: { framesInSubtree: [main, office] } }]
  const result = collectPerformanceSources()
  expect(result.sources.get(101)?.[0].title).toBe('性能监控')
  expect(result.sources.get(202)?.[0]).toMatchObject({ kind: 'Office 页面', url: 'http://127.0.0.1:8888/office.html' })
  expect(result.sources.has(901)).toBe(false)
  expect(result.resources.frames).toBe(2)
})
it('redacts URL credentials, query data and non-route fragments', () => {
  expect(diagnosticUrl('https://user:pass@example.com/page?access_token=secret#token')).toBe('https://example.com/page')
  expect(diagnosticUrl('file:///private/notes/app/index.html#/editor?external=secret')).toBe('index.html#/editor')
})
