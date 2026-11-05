import { createHash } from "node:crypto"
import { mkdtemp, rm, readdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, it, vi } from "vitest"
import fixtures from "@tests/fixtures/extension-archives.json"
import { prepareStoreExtension, storeDownloadURL, webStoreExtensionId } from "@main/browser/extensions/extension-store"
const key = Buffer.from("test-extension-public-key")
const id = createHash("sha256").update(key).digest("hex").slice(0,32).replace(/[0-9a-f]/g, n => String.fromCharCode(97+parseInt(n,16)))
function archive() {
  const header = Buffer.alloc(16); header.write("Cr24"); header.writeUInt32LE(2,4); header.writeUInt32LE(key.length,8)
  return Buffer.concat([header,key,Buffer.from(fixtures.zip,"base64")])
}
it("仅接受官方 HTTPS 商店详情页和合法扩展 ID", () => {
  expect(webStoreExtensionId(`https://chromewebstore.google.com/detail/test/${id}?hl=zh-CN`)).toBe(id)
  expect(webStoreExtensionId(`https://chromewebstore.google.com/detail/${id}`)).toBe(id)
  for(const value of [`http://chromewebstore.google.com/detail/${id}`, `https://evil.test/detail/test/${id}`, `https://chromewebstore.google.com.evil.test/detail/${id}`, `https://chromewebstore.google.com/detail/test/${id}/reviews`]) expect(webStoreExtensionId(value)).toBeNull()
  const url = new URL(storeDownloadURL(id,"142.0.0.0"))
  expect(url.hostname).toBe("clients2.google.com")
  expect(url.searchParams.get("x")).toContain(`id=${id}&`)
  expect(() => storeDownloadURL("../../bad","142")).toThrow()
})
it("下载并解包但不加载扩展，保留正式 ID 和候选目录", async () => {
  const root = await mkdtemp(join(tmpdir(),"vessel-store-test-"))
  try {
    const fetcher = vi.fn(async () => new Response(archive(), {status:200}))
    const result = await prepareStoreExtension(id,root,"142.0.0.0",fetcher)
    expect(result.name).toBeTruthy()
    expect(result.path.startsWith(result.directory)).toBe(true)
    expect(result.permissions).toBeInstanceOf(Array)
    expect(await readdir(root)).toHaveLength(1)
  } finally { await rm(root,{recursive:true,force:true}) }
})
it("拒绝不可信重定向，并停止后续请求", async () => {
  const fetcher = vi.fn(async () => new Response(null,{status:302,headers:{location:"https://evil.test/extension.crx"}}))
  await expect(prepareStoreExtension(id,tmpdir(),"142",fetcher)).rejects.toThrow("非 Google")
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it("拒绝不匹配的包和超大下载，不留下导入目录", async () => {
  const root = await mkdtemp(join(tmpdir(),"vessel-store-test-"))
  try {
    await expect(prepareStoreExtension("a".repeat(32),root,"142",async()=>new Response(archive()))).rejects.toThrow("ID")
    await expect(prepareStoreExtension(id,root,"142",async()=>new Response("x",{headers:{"content-length":String(129*1024*1024)}}))).rejects.toThrow("128")
    expect(await readdir(root)).toHaveLength(0)
  } finally { await rm(root,{recursive:true,force:true}) }
})
it("商店没有可用下载包时提供错误结果", async () => {
  await expect(prepareStoreExtension(id,tmpdir(),"142",async()=>new Response(null,{status:404}))).rejects.toThrow("404")
})
