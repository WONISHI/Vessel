import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, it } from "vitest"
import fixtures from "../fixtures/extension-archives.json"
import { extensionZip, importExtensionArchive } from "../../src/main/extension-archive"
const zip = Buffer.from(fixtures.zip, "base64")
for (const version of [2, 3]) {
  it(`unpacks CRX${version} including a wrapper directory`, async () => {
    const root = await mkdtemp(join(tmpdir(), "vessel-crx-"))
    const header = Buffer.alloc(version === 2 ? 16 : 12)
    header.write("Cr24"); header.writeUInt32LE(version, 4)
    const source = join(root, "sample.crx")
    await writeFile(source, Buffer.concat([header, zip]))
    try {
      const result = await importExtensionArchive(source, join(root, "managed"))
      expect(result.candidates).toHaveLength(1)
      expect(JSON.parse(await readFile(join(result.candidates[0].path, "manifest.json"), "utf8")).name).toBe("Sample")
      expect(await readFile(source)).toEqual(Buffer.concat([header, zip]))
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
for (const format of ["zip", "nested"] as const) it(`imports ${format === "nested" ? "a ZIP containing CRX" : "a ZIP extension"}`, async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-zip-"))
  try {
    const source = join(root, "source.zip"); await writeFile(source, Buffer.from(fixtures[format], "base64"))
    expect((await importExtensionArchive(source, join(root, "managed"))).candidates[0].name).toBe("Sample")
  } finally { await rm(root, { recursive: true, force: true }) }
})
for (const format of ["traversal", "invalid"] as const) it(`rejects ${format} and removes staging files`, async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-invalid-"))
  try {
    const source = join(root, "source.zip"); await writeFile(source, Buffer.from(fixtures[format], "base64"))
    await expect(importExtensionArchive(source, join(root, "managed"))).rejects.toThrow()
    expect(await readdir(join(root, "managed"))).toEqual([])
  } finally { await rm(root, { recursive: true, force: true }) }
})
it("rejects truncated CRX headers", () => { expect(() => extensionZip(Buffer.from("Cr24"))).toThrow("不完整") })
