import { app, type WebContents } from 'electron'
import { createHash } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { WorkspaceGraph } from '../../../packages/@vessel/workspace/src/graph/types'

type Job = { worker: Worker; owners: Set<number>; promise: Promise<WorkspaceGraph>; cancel: () => void; progress: Map<number, (graph: WorkspaceGraph) => void>; latest?: WorkspaceGraph }
const jobs = new Map<string, Job>()
const owners = new WeakSet<WebContents>()
export function watchGraphOwner(contents: WebContents) {
  if (owners.has(contents)) return
  owners.add(contents)
  const owner = contents.id
  contents.once('destroyed', () => cancelWorkspaceGraph(owner))
}
const pending = new Map<string, symbol>()

/** One scan per root; simultaneous consumers share it, cancellation releases the last worker. */
export async function readWorkspaceGraph(owner: number, root: unknown, onProgress?: (graph: WorkspaceGraph) => void): Promise<WorkspaceGraph> {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new Error('工作区路径无效')
  const key = `${owner}:${root}`
  const token = Symbol()
  pending.set(key, token)
  let base: string
  try {
    base = await realpath(root)
    if (!(await stat(base)).isDirectory()) throw new Error('请选择工作区目录')
  } catch (error) { if (pending.get(key) === token) pending.delete(key); throw error }
  if (pending.get(key) !== token) throw new Error('关系图谱读取已取消')
  pending.delete(key)
  const previous = jobs.get(base)
  if (previous && !previous.owners.size) {
    await previous.worker.terminate()
    if (jobs.get(base) === previous) jobs.delete(base)
  }
  const current = jobs.get(base)
  if (current?.owners.size) {
    current.owners.add(owner)
    if (onProgress) { current.progress.set(owner, onProgress); if (current.latest) onProgress(current.latest) }
    return current.promise
  }
  const cache = join(app.getPath('userData'), 'workspace-graph', createHash('sha256').update(base).digest('hex'))
  const worker = new Worker(join(__dirname, 'workspace-graph-worker.js'), { workerData: { root: base, cache } })
  let fail!: (error: Error) => void
  const promise = new Promise<WorkspaceGraph>((resolve, reject) => {
    fail = reject
    worker.on('message', (message) => {
      if (message.type === 'progress') {
        job.latest = message.graph
        for (const notify of job.progress.values()) notify(message.graph)
      } else if (message.error) reject(new Error(message.error))
      else resolve(message.graph)
    })
    worker.once('error', reject)
    worker.once('exit', (code) => reject(new Error(`图谱索引线程已退出（${code}）`)))
  })
  const job: Job = { worker, owners: new Set([owner]), progress: new Map(onProgress ? [[owner, onProgress]] : []), promise, cancel: () => { fail(new Error('关系图谱读取已取消')); void worker.terminate() } }
  jobs.set(base, job)
  try { return await promise } finally { if (jobs.get(base) === job) jobs.delete(base); void worker.terminate() }
}
export function cancelWorkspaceGraph(owner: number) {
  for (const key of pending.keys()) if (key.startsWith(`${owner}:`)) pending.delete(key)
  for (const job of jobs.values()) {
    job.owners.delete(owner)
    job.progress.delete(owner)
    if (!job.owners.size) job.cancel()
  }
}
export function disposeWorkspaceGraphs() { pending.clear(); for (const job of jobs.values()) job.cancel(); jobs.clear() }
