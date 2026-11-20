import { mkdtemp, mkdir, writeFile, rm, unlink, symlink, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { runWorkspaceIndex } from '../src/graph/run-index'
const temporary: string[] = []
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }) })
it('runs the actual Rust WASM, reuses unchanged files and handles changes/deletions without leaving the root', async () => {
 const base = await mkdtemp(join(tmpdir(), 'vessel-graph-test-')); temporary.push(base)
 const root = join(base, 'notes'), cache = join(base, 'cache')
 await mkdir(root); await mkdir(join(root, 'assets')); await mkdir(join(root, 'node_modules'))
 await writeFile(join(root, 'a.md'), '---\ntags: [项目, rust]\n---\n[[中文笔记|别名]] ![[assets/pic.png]] #开发/工具\n`[[fake]]`\n```\n[[also-fake]]\n```')
 await writeFile(join(root, '中文笔记.md'), '[返回](a.md#title)')
 await writeFile(join(root, 'assets/pic.png'), '')
 await writeFile(join(root, 'node_modules/ignore.md'), '[[ignored]]')
 await writeFile(join(base, 'outside.md'), '[[outside]]')
 await symlink(join(base, 'outside.md'), join(root, 'escape.md'))
 const wasm = resolve('packages/@vessel/workspace/wasm/workspace-index.wasm')
 const progress: number[] = []
 let finished = false
 const first = await runWorkspaceIndex(wasm, root, cache, (partial) => {
   expect(finished).toBe(false)
   progress.push(partial.stats.files)
 })
 finished = true
 expect(progress[0]).toBe(1)
 expect(progress.at(-1)).toBe(3)
 expect(progress.length).toBeGreaterThan(1)
 expect(first.stats.files).toBe(3)
 expect(first.edges.some((edge) => edge.source === 'a.md' && edge.target === '中文笔记.md')).toBe(true)
 expect(first.edges.some((edge) => edge.source === 'a.md' && edge.target === 'assets/pic.png')).toBe(true)
 expect(first.nodes.some((node) => node.id === 'tag:开发/工具')).toBe(true)
 expect(first.nodes.some((node) => /fake|ignored|outside|escape/.test(node.id))).toBe(false)
 const second = await runWorkspaceIndex(wasm, root, cache)
 expect(second.stats.reused).toBe(3); expect(second.stats.scanned).toBe(0)
 await writeFile(join(root, 'a.md'), '[[new-target]]')
 await unlink(join(root, '中文笔记.md'))
 const third = await runWorkspaceIndex(wasm, root, cache)
 expect(third.stats.files).toBe(2); expect(third.stats.scanned).toBe(1)
 expect(third.nodes.some((node) => node.id === '中文笔记.md')).toBe(false)
 expect(third.nodes.some((node) => node.id === 'missing:new-target')).toBe(true)
 expect(JSON.parse(await readFile(join(cache, 'index.json'), 'utf8')).version).toBe(2)
})
