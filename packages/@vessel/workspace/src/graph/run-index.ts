import { mkdir, readFile } from 'node:fs/promises'
import { WASI } from 'node:wasi'
import { buildWorkspaceGraph } from './model'
import type { IndexedFile, RawIndex, WorkspaceGraph } from './types'

/** Run trusted, bundled Rust in a background Node worker; no code is loaded from the workspace. */
export async function runWorkspaceIndex(wasmPath: string, root: string, cacheDirectory: string, onProgress?: (graph: WorkspaceGraph) => void): Promise<WorkspaceGraph> {
  await mkdir(cacheDirectory, { recursive: true })
  const wasi = new WASI({ version: 'preview1', args: ['workspace-index', '/workspace', '/cache/index.json'], preopens: { '/workspace': root, '/cache': cacheDirectory }, returnOnExit: true })
  const module = await WebAssembly.compile(await readFile(wasmPath))
  const imports = wasi.getImportObject() as WebAssembly.Imports
  const system = imports.wasi_snapshot_preview1 as Record<string, (...args: number[]) => number>
  const originalWrite = system.fd_write
  let pending = ''
  const decoder = new TextDecoder()
  const partial: RawIndex = { version: 2, files: [], warnings: [], scanned: 0, reused: 0, elapsedMs: 0 }
  const started = Date.now()
  let published = 0
  const publish = () => {
    if (!onProgress || partial.files.length === published) return
    partial.elapsedMs = Date.now() - started
    onProgress(buildWorkspaceGraph(partial))
    published = partial.files.length
  }
  let lastUpdate = started
  // Rust emits one JSON record per file. Capture stdout directly from WASI so
  // progress is available even while wasi.start is running synchronously.
  system.fd_write = (fd, iovs, count, written) => {
    if (fd !== 1) return originalWrite(fd, iovs, count, written)
    const view = new DataView(memory.buffer)
    let bytes = 0
    for (let index = 0; index < count; index++) {
      const pointer = view.getUint32(iovs + index * 8, true)
      const length = view.getUint32(iovs + index * 8 + 4, true)
      pending += decoder.decode(new Uint8Array(memory.buffer, pointer, length), { stream: true })
      bytes += length
    }
    view.setUint32(written, bytes, true)
    let newline: number
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1)
      if (!line) continue
      const message = JSON.parse(line) as { file: IndexedFile; scanned: number; reused: number }
      partial.files.push(message.file); partial.scanned = message.scanned; partial.reused = message.reused
    }
    if (!published || Date.now() - lastUpdate >= 350) { publish(); lastUpdate = Date.now() }
    return 0
  }
  const instance = await WebAssembly.instantiate(module, imports)
  const memory = instance.exports.memory as WebAssembly.Memory
  const code = wasi.start(instance)
  publish()
  if (code !== 0) throw new Error(`工作区索引失败（${code}），请检查目录读取权限`)
  const raw = JSON.parse(await readFile(`${cacheDirectory}/index.json`, 'utf8')) as RawIndex
  return buildWorkspaceGraph(raw)
}
