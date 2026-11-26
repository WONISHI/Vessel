import type { CodeDefinition, CodeDefinitionRequest } from '@vessel/type'
import { isAbsolute, join } from 'node:path'
import { Worker } from 'node:worker_threads'

let worker: Worker | undefined
let sequence = 0
let idleTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<number, { resolve(value: CodeDefinition[]): void; reject(error: Error): void }>()

export function disposeCodeDefinitions(reason = new Error('代码导航已停止')) {
  clearTimeout(idleTimer)
  const previous = worker
  worker = undefined
  void previous?.terminate()
  for (const request of pending.values()) request.reject(reason)
  pending.clear()
}

/** Keep filesystem and TypeScript work off Electron's UI thread. Release the heap when idle. */
export function getCodeDefinitions(request: CodeDefinitionRequest): Promise<CodeDefinition[]> {
  if (!request || typeof request.path !== 'string' || !isAbsolute(request.path) || !/\.(vue|[cm]?[jt]sx?)$/i.test(request.path) || typeof request.content !== 'string' || request.content.length > 5_000_000 || !Number.isSafeInteger(request.offset) || request.offset < 0 || request.offset > request.content.length) return Promise.reject(new Error('代码导航参数无效'))
  if (pending.size >= 16) return Promise.reject(new Error('代码导航繁忙，请重试'))
  clearTimeout(idleTimer)
  if (!worker) {
    const instance = new Worker(join(__dirname, 'code-diagnostics-worker.js'))
    worker = instance
    instance.on('message', ({ id, definitions, error }) => {
      if (worker !== instance) return
      const job = pending.get(id)
      pending.delete(id)
      if (error) job?.reject(new Error(error)); else job?.resolve(definitions)
      if (!pending.size) {
        idleTimer = setTimeout(disposeCodeDefinitions, 60_000)
        idleTimer.unref()
      }
    })
    instance.on('error', error => { if (worker === instance) disposeCodeDefinitions(error) })
    instance.on('exit', () => { if (worker === instance) disposeCodeDefinitions() })
    instance.unref()
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    worker!.postMessage({ kind: 'definitions', id, ...request })
  })
}
