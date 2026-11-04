import type { CodeDiagnostic } from '@vessel/type'
import { isAbsolute, join } from 'node:path'
import { Worker } from 'node:worker_threads'
type Job = { id: number; path: string; content: string; resolve: (value: CodeDiagnostic[]) => void; reject: (error: Error) => void }
let worker: Worker | undefined
let sequence = 0
let active: Job | undefined
const queue = new Map<string, Job>()
let idleTimer: ReturnType<typeof setTimeout> | undefined
let idleReleaseAt: number | undefined
let lastMemory: { heapUsed: number; sampledAt: number } | undefined
const IDLE_MS = 60_000

export function getCodeDiagnosticsState() {
  return { running: !!worker, pending: active ? 1 : 0, queued: queue.size, queuedBytes: [...queue.values()].reduce((size, item) => size + item.content.length * 2, 0), idleReleaseAt, ...lastMemory }
}

/** Drop the worker's TypeScript heap after inactivity; newer requests recreate it lazily. */
export function disposeCodeDiagnostics() {
  clearTimeout(idleTimer); idleTimer = undefined; idleReleaseAt = undefined
  const previous = worker
  worker = undefined
  void previous?.terminate()
  active?.reject(new Error('代码检查已停止')); active = undefined
  for (const job of queue.values()) job.reject(new Error('代码检查已停止'))
  queue.clear(); lastMemory = undefined
}

function pump() {
  if (active) return
  if (!queue.size) {
    if (worker) {
      idleReleaseAt = Date.now() + IDLE_MS
      idleTimer = setTimeout(disposeCodeDiagnostics, IDLE_MS)
      idleTimer.unref()
    }
    return
  }
  clearTimeout(idleTimer); idleTimer = undefined; idleReleaseAt = undefined
  if (!worker) {
    const instance = new Worker(join(__dirname, 'code-diagnostics-worker.js'))
    worker = instance
    instance.on('message', ({ id, diagnostics, error, memory }) => {
      if (worker !== instance || !active || active.id !== id) return
      const job = active; active = undefined
      if (memory && Number.isFinite(memory.heapUsed)) lastMemory = { heapUsed: memory.heapUsed, sampledAt: Date.now() }
      if (error) job.reject(new Error(error)); else job.resolve(diagnostics)
      pump()
    })
    instance.on('error', () => { if (worker === instance) disposeCodeDiagnostics() })
    instance.on('exit', () => { if (worker === instance) disposeCodeDiagnostics() })
    instance.unref()
  }
  active = queue.values().next().value!
  queue.delete(active.path)
  try { worker.postMessage({ id: active.id, path: active.path, content: active.content }) } catch { disposeCodeDiagnostics() }
}

/** Coalesce pending versions per file instead of posting every full source into the worker queue. */
export function getCodeDiagnostics(path: unknown, content: unknown): Promise<CodeDiagnostic[]> {
  if (typeof path !== 'string' || !isAbsolute(path) || !/\.[cm]?[jt]sx?$/i.test(path) || typeof content !== 'string' || content.length > 5_000_000) return Promise.reject(new Error('代码检查的文件或内容无效'))
  return new Promise((resolve, reject) => {
    queue.get(path)?.reject(new Error('代码检查已被较新的内容替代'))
    queue.delete(path)
    queue.set(path, { id: ++sequence, path, content, resolve, reject })
    while (queue.size > 8 || getCodeDiagnosticsState().queuedBytes > 16 * 1024 ** 2) {
      const old = queue.values().next().value!
      queue.delete(old.path); old.reject(new Error('代码检查队列繁忙，请重试'))
    }
    try { pump() } catch { disposeCodeDiagnostics() }
  })
}
