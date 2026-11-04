import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ instances: [] as any[] }))
vi.mock('node:worker_threads', () => ({ Worker: class {
  listeners = new Map<string, (...args: any[]) => void>()
  postMessage = vi.fn()
  terminate = vi.fn().mockResolvedValue(0)
  unref = vi.fn()
  constructor() { mocks.instances.push(this) }
  on(name: string, callback: (...args: any[]) => void) { this.listeners.set(name, callback); return this }
  emit(name: string, value?: any) { this.listeners.get(name)?.(value) }
} }))
import { getCodeDiagnostics, getCodeDiagnosticsState, disposeCodeDiagnostics } from '@main/diagnostics/code-diagnostics'
afterEach(() => { disposeCodeDiagnostics(); mocks.instances.length = 0; vi.useRealTimers() })
it('coalesces queued versions and releases the worker after 60 idle seconds', async () => {
  vi.useFakeTimers()
  const first = getCodeDiagnostics('/a.ts', 'first')
  const old = getCodeDiagnostics('/a.ts', 'old').catch(error => error.message)
  const latest = getCodeDiagnostics('/a.ts', 'latest')
  expect(await old).toContain('替代')
  const worker = mocks.instances[0]
  expect(worker.postMessage).toHaveBeenCalledTimes(1)
  worker.emit('message', { id: worker.postMessage.mock.calls[0][0].id, diagnostics: [] })
  await first
  expect(worker.postMessage.mock.calls[1][0].content).toBe('latest')
  worker.emit('message', { id: worker.postMessage.mock.calls[1][0].id, diagnostics: [], memory: { heapUsed: 1234 } })
  await latest
  expect(getCodeDiagnosticsState()).toMatchObject({ running: true, pending: 0, queued: 0, heapUsed: 1234 })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(worker.terminate).toHaveBeenCalledOnce()
  expect(getCodeDiagnosticsState()).toMatchObject({ running: false, pending: 0, queued: 0 })
})
it('ignores exit events from an old worker after a new worker starts', async () => {
  const first = getCodeDiagnostics('/a.ts', 'first').catch(() => [])
  const old = mocks.instances[0]
  disposeCodeDiagnostics(); await first
  const next = getCodeDiagnostics('/b.ts', 'next')
  old.emit('exit')
  const current = mocks.instances[1]
  expect(getCodeDiagnosticsState().pending).toBe(1)
  current.emit('message', { id: current.postMessage.mock.calls[0][0].id, diagnostics: [] })
  expect(await next).toEqual([])
})

it('bounds queued work across distinct paths', async () => {
  const active = getCodeDiagnostics('/active.ts', 'a').catch(error => error.message)
  const pending = Array.from({ length: 10 }, (_, index) => getCodeDiagnostics(`/queued-${index}.ts`, 'data').catch(error => error.message))
  expect(getCodeDiagnosticsState()).toMatchObject({ pending: 1, queued: 8, queuedBytes: 64 })
  expect(await pending[0]).toContain('繁忙')
  expect(await pending[1]).toContain('繁忙')
  disposeCodeDiagnostics()
  await active; await Promise.all(pending)
})
