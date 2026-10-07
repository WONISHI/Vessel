import { Worker } from "node:worker_threads"
import { isAbsolute, join } from "node:path"
import type { CodeDiagnostic } from "../shared/code-diagnostics"
let worker: Worker | undefined
let sequence = 0
const pending = new Map<number, { resolve: (value: CodeDiagnostic[]) => void; reject: (error: Error) => void }>()
export function disposeCodeDiagnostics() {
  const previous = worker
  worker = undefined
  void previous?.terminate()
  for (const request of pending.values()) request.reject(new Error("代码检查已停止"))
  pending.clear()
}
export function getCodeDiagnostics(path: unknown, content: unknown): Promise<CodeDiagnostic[]> {
  if (typeof path !== "string" || !isAbsolute(path) || !/\.[cm]?[jt]sx?$/i.test(path) || typeof content !== "string" || content.length > 5_000_000) return Promise.reject(new Error("代码检查的文件或内容无效"))
  if (!worker) {
    worker = new Worker(join(__dirname, "code-diagnostics-worker.js"))
    worker.on("message", ({ id, diagnostics, error }) => {
      const request = pending.get(id)
      pending.delete(id)
      if (error) request?.reject(new Error(error))
      else request?.resolve(diagnostics)
    })
    worker.on("error", disposeCodeDiagnostics)
    worker.unref()
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    worker!.postMessage({ id, path, content })
  })
}
