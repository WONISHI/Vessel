import { expect, it, vi } from "vitest"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { createS3Storage, signedS3Request } from "#vessel-sync/index"
import { parseS3List } from "#vessel-sync/s3-list"
const config = { endpoint: "https://storage.example.com", bucket: "notes", region: "us-east-1", accessKey: "AKID" }

/** Performs the page operation. */
const page = (entries: string, truncated = false, next = "") =>
  `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><EncodingType>url</EncodingType><IsTruncated>${truncated}</IsTruncated>${entries}${next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ""}</ListBucketResult>`

/** Performs the object operation. */
const object = (key: string) => `<Contents><Key>${encodeURIComponent(key)}</Key><ETag>&quot;etag&quot;</ETag><Size>5</Size><LastModified>2026-10-14T00:00:00Z</LastModified></Contents>`
it("signs sorted query parameters and reads all listing pages including unicode keys", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(page(object("notes/中文 & file.md"), true, "a+/=&amp;token")))
    .mockResolvedValueOnce(new Response(page(object("notes/next.md"))))
  const storage = createS3Storage(config, "secret", { fetch: fetcher })
  const files = await storage.list!("notes/")
  expect([...files.keys()]).toEqual(["notes/中文 & file.md", "notes/next.md"])
  expect(files.get("notes/next.md")).toMatchObject({ etag: '"etag"', size: 5, digest: null })
  const url = new URL(fetcher.mock.calls[1][0])
  expect(url.searchParams.get("continuation-token")).toBe("a+/=&token")
  expect(url.searchParams.get("prefix")).toBe("notes/")
  const now = new Date("2026-10-14T00:00:00Z")
  const a = signedS3Request(config, "secret", "GET", "", undefined, now, { query: { prefix: "a b/", "list-type": "2" } })
  const b = signedS3Request(config, "secret", "GET", "", undefined, now, { query: { "list-type": "2", prefix: "a b/" } })
  expect(a.headers.Authorization).toBe(b.headers.Authorization)
  expect(a.url).toContain("list-type=2&prefix=a%20b%2F")
})
it("refuses malformed XML, missing pagination tokens and duplicate pages", async () => {
  for (const xml of ["<ListBucketResult>", page("", true), page("<Contents><Key>bad</Key></Contents>"), page(object("a") + object("a")), "<!DOCTYPE x><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>"]) expect(() => parseS3List(xml)).toThrow()
  const fetcher = vi.fn(async () => new Response(page("", true, "same-token")))
  await expect(createS3Storage(config, "secret", { fetch: fetcher }).list!("")).rejects.toThrow("分页未前进")
})
it("streams conditional GET to disk and sends a conditional DELETE", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-download-protocol-"))
  try {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("hello", { headers: { etag: '"version"', "content-length": "5" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const storage = createS3Storage(config, "secret", { fetch: fetcher }),
      destination = join(root, "file.md"),
      progress = vi.fn()
    expect(await storage.download!("file.md", destination, { etag: '"version"', onProgress: progress })).toMatchObject({ etag: '"version"', size: 5 })
    expect(await readFile(destination, "utf8")).toBe("hello")
    expect(progress).toHaveBeenLastCalledWith(5)
    await storage.remove!("file.md", { etag: '"version"' })
    expect(fetcher.mock.calls.map((call) => call[1].headers["if-match"])).toEqual(['"version"', '"version"'])
    expect(fetcher.mock.calls[1][1].method).toBe("DELETE")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
it("uploads exact multipart bytes with bounded part concurrency and conditional completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-multipart-protocol-"))
  try {
    const content = Buffer.alloc(11 * 1024 ** 2 + 13, 7),
      source = join(root, "large.bin")
    await writeFile(source, content)
    const parts = new Map<number, Buffer>(),
      progress = vi.fn()
    let active = 0,
      maximum = 0
    const fetcher = vi.fn(async (urlText, input) => {
      const url = new URL(urlText)
      if (input.method === "POST" && url.searchParams.has("uploads")) return new Response("<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>")
      if (input.method === "PUT") {
        active++
        maximum = Math.max(maximum, active)
        await delay(5)
        const part = Number(url.searchParams.get("partNumber")),
          body = Buffer.from(input.body)
        expect(input.headers["x-amz-content-sha256"]).toBe(createHash("sha256").update(body).digest("hex"))
        parts.set(part, body)
        active--
        return new Response(null, { headers: { etag: `"part-${part}"` } })
      }
      expect(input.method).toBe("POST")
      expect(input.headers["if-none-match"]).toBe("*")
      expect(Buffer.from(input.body).toString()).toContain("<PartNumber>3</PartNumber>")
      return new Response("<CompleteMultipartUploadResult><ETag>&quot;combined&quot;</ETag></CompleteMultipartUploadResult>")
    })
    const storage = createS3Storage(config, "secret", { fetch: fetcher, retries: 0, multipartThreshold: 5 * 1024 ** 2, partSize: 5 * 1024 ** 2, partConcurrency: 2 })
    expect(await storage.upload("large.bin", source, { digest: createHash("sha256").update(content).digest("hex"), size: content.length, onProgress: progress })).toMatchObject({ etag: '"combined"', size: content.length })
    expect(maximum).toBe(2)
    expect(Buffer.concat([...parts].sort(([a], [b]) => a - b).map(([, bytes]) => bytes)).equals(content)).toBe(true)
    expect(progress).toHaveBeenLastCalledWith(content.length)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
it("aborts unfinished multipart sessions and rejects errors embedded in HTTP 200 completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-multipart-error-"))
  try {
    const source = join(root, "large.bin"),
      size = 6 * 1024 ** 2
    await writeFile(source, Buffer.alloc(size))
    const methods: string[] = []
    const fetcher = vi.fn(async (url, input) => {
      methods.push(input.method)
      if (input.method === "DELETE") return new Response(null, { status: 204 })
      if (input.method === "PUT") return new Response(null, { headers: { etag: '"part"' } })
      if (new URL(url).searchParams.has("uploads")) return new Response("<InitiateMultipartUploadResult><UploadId>upload-1</UploadId></InitiateMultipartUploadResult>")
      return new Response("<Error><Code>InvalidPart</Code></Error>")
    })
    const storage = createS3Storage(config, "secret", { fetch: fetcher, retries: 0, multipartThreshold: 5 * 1024 ** 2 })
    await expect(storage.upload("large.bin", source, { size, digest: "unused" })).rejects.toMatchObject({ code: "S3_REQUEST" })
    expect(methods.at(-1)).toBe("DELETE")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
