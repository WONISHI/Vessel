import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ workers: [] as any[], resolvePath: undefined as undefined | (() => Promise<string>) }))
vi.mock('electron', () => ({ app: { getPath: () => '/cache' } }))
vi.mock('node:fs/promises', () => ({ realpath: () => state.resolvePath ? state.resolvePath() : Promise.resolve('/vault'), stat: async () => ({ isDirectory: () => true }) }))
vi.mock('node:worker_threads', async () => {
 const { EventEmitter } = await import('node:events')
 return { Worker: class extends EventEmitter {
  terminate = vi.fn(async () => 0)
  constructor() { super(); state.workers.push(this) }
 } }
})
import { cancelWorkspaceGraph, disposeWorkspaceGraphs, readWorkspaceGraph } from '../../src/main/workspace/graph-service'
afterEach(() => { disposeWorkspaceGraphs(); state.workers = []; state.resolvePath = undefined })
it('terminates the index worker when its last viewer closes and rejects late results', async () => {
 const progress = vi.fn()
 const request = readWorkspaceGraph(1, '/vault', progress)
 const result = expect(request).rejects.toThrow('已取消')
 await vi.waitFor(() => expect(state.workers).toHaveLength(1))
 const worker = state.workers[0] as EventEmitter & { terminate: ReturnType<typeof vi.fn> }
 worker.emit('message', {type:'progress',graph:{nodes:[]}})
 expect(progress).toHaveBeenCalledOnce()
 cancelWorkspaceGraph(1)
 worker.emit('message', {type:'progress',graph:{nodes:[1]}})
 await result
 expect(worker.terminate).toHaveBeenCalled()
 expect(progress).toHaveBeenCalledOnce()
})
it('does not start an index worker if the view closes during path validation', async () => {
 let release!: (path: string) => void
 state.resolvePath = () => new Promise(resolve => { release = resolve })
 const request = readWorkspaceGraph(1, '/vault')
 const result = expect(request).rejects.toThrow('已取消')
 cancelWorkspaceGraph(1)
 release('/vault')
 await result
 expect(state.workers).toHaveLength(0)
})
