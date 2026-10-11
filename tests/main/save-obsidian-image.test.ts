import { it, expect, vi } from 'vitest'
import { mkdtemp, realpath, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), partition: vi.fn() }))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer: (data: Buffer) => ({ isEmpty: () => !data.length, toPNG: () => data }) }, session: { fromPartition: (name: string) => { mocks.partition(name); return { fetch: mocks.fetch } } } }))
import { saveObsidianImage } from '../../src/main/modules/files/save-obsidian-image'
it('writes root attachments with timestamp names, preserves collisions and validates the document', async () => {
 const root=await mkdtemp(join(tmpdir(),'vessel-paste-')); const doc=join(root,'note.md')
 try {
  await writeFile(doc,'')
  const first=await saveObsidianImage(root,doc,{bytes:new Uint8Array([1,2])})
  const second=await saveObsidianImage(root,doc,{bytes:new Uint8Array([3,4])})
  expect(first.name).toMatch(/^Pasted image \d{14}\.png$/)
  expect(first.path).toBe(join(await realpath(root),first.name)); expect(first.reference).toBe(`![[${first.name}]]`)
  expect(second.name).not.toBe(first.name); expect(await readFile(first.path)).toEqual(Buffer.from([1,2]))
  await expect(saveObsidianImage(root,root,{bytes:new Uint8Array([1])})).rejects.toThrow('文档不在工作区')
 } finally { await rm(root,{recursive:true,force:true}) }
})
it('downloads through browser session and rejects non-images without creating files', async () => {
 const root=await mkdtemp(join(tmpdir(),'vessel-download-')); const doc=join(root,'note.md')
 try {
  await writeFile(doc,'')
  mocks.fetch.mockResolvedValueOnce(new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))
  const saved=await saveObsidianImage(root,doc,{url:'https://example.com/img?format=svg'})
  expect(saved.name).toMatch(/\.svg$/); expect(mocks.partition).toHaveBeenCalledWith('persist:vessel-browser')
  const before=await readdir(root)
  mocks.fetch.mockResolvedValueOnce(new Response('<html>login</html>'))
  await expect(saveObsidianImage(root,doc,{url:'https://example.com/login'})).rejects.toThrow('不是支持的图片')
  expect(await readdir(root)).toEqual(before)
 } finally { await rm(root,{recursive:true,force:true}) }
})
