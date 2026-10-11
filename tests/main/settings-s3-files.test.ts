import { afterEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "../../src/shared/settings"
import { headS3File, uploadS3File } from "../../src/main/settings-s3"
const config = { ...defaultSettings.backup, endpoint: "https://storage.example.com", bucket: "notes", accessKey: "AKID", region: "us-east-1" }
afterEach(() => vi.unstubAllGlobals())
it("distinguishes absent files from denied remote access", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 403 })))
  expect(await headS3File(config, "secret", "a.md")).toBeUndefined()
  await expect(headS3File(config, "secret", "a.md")).rejects.toThrow("403")
})
it("streams the exact file, signs content metadata and rejects concurrent overwrites", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vessel-s3-stream-"))
  try {
    const source = join(directory, "file.txt")
    const body = Buffer.from("完整文件内容")
    await writeFile(source, body)
    const digest = createHash("sha256").update(body).digest("hex")
    const fetcher = vi.fn(async (_url, init) => {
      const chunks: Buffer[] = []
      for await (const chunk of init.body) chunks.push(chunk)
      expect(Buffer.concat(chunks)).toEqual(body)
      expect(init.headers["x-amz-content-sha256"]).toBe(digest)
      expect(init.headers["x-amz-meta-sha256"]).toBe(digest)
      expect(init.headers["content-length"]).toBe(String(body.length))
      expect(init.headers.Authorization).toContain("x-amz-meta-sha256")
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal("fetch", fetcher)
    await uploadS3File(config, "secret", "中文/file.txt", source, digest, body.length)
    expect(fetcher.mock.calls[0][1].headers["if-none-match"]).toBe("*")
    await uploadS3File(config, "secret", "中文/file.txt", source, digest, body.length, '"old-etag"')
    expect(fetcher.mock.calls[1][1].headers["if-match"]).toBe('"old-etag"')
    fetcher.mockResolvedValueOnce(new Response(null, { status: 412 }))
    await expect(uploadS3File(config, "secret", "中文/file.txt", source, digest, body.length, '"old-etag"')).rejects.toThrow("未覆盖")
  } finally { await rm(directory, { recursive: true, force: true }) }
})
