import { expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createS3Storage } from "#vessel-sync/index"
const config = { endpoint: "https://storage.example.com", bucket: "notes", region: "us-east-1", accessKey: "AKID" }
it("retries transient responses, but never retries permissions failures", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { headers: { etag: '"etag"', "x-amz-meta-sha256": "hash" } }))
  const storage = createS3Storage(config, "secret", { fetch: fetcher, retries: 1 })
  expect(await storage.head("a.md")).toEqual({ digest: "hash", etag: '"etag"' })
  expect(fetcher).toHaveBeenCalledTimes(2)
  fetcher.mockClear().mockResolvedValue(new Response(null, { status: 403 }))
  await expect(storage.head("a.md")).rejects.toMatchObject({ code: "S3_REQUEST", details: { status: 403 } })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it("reopens upload streams on retry and reconciles an already committed conditional PUT", async () => {
  const root = await mkdtemp(join(tmpdir(), "sync-retry-"))
  try {
    const source = join(root, "a.md")
    await writeFile(source, "body")
    let attempt = 0
    const bodies: string[] = []
    const fetcher = vi.fn(async (_url, input) => {
      if (input.method === "HEAD") return new Response(null, { headers: { "x-amz-meta-sha256": "digest" } })
      const chunks: Buffer[] = []
      for await (const chunk of input.body) chunks.push(chunk)
      bodies.push(Buffer.concat(chunks).toString())
      return new Response(null, { status: ++attempt === 1 ? 503 : 412 })
    })
    const storage = createS3Storage(config, "secret", { fetch: fetcher, retries: 1 })
    await storage.upload("a.md", source, { digest: "digest", size: 4 })
    expect(bodies).toEqual(["body", "body"])
    expect(fetcher).toHaveBeenCalledTimes(3)
    const controller = new AbortController()
    controller.abort(new Error("cancelled"))
    await expect(storage.head("a.md", controller.signal)).rejects.toThrow("cancelled")
    expect(fetcher).toHaveBeenCalledTimes(3)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
