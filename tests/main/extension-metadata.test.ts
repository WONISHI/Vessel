import { it, expect } from "vitest"
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { extensionMetadata, extensionFile } from "../../src/main/extension-metadata"
import type { BrowserExtension } from "../../src/shared/browser-extensions"
it("reads actual action metadata and raster icons, rejecting files outside the extension", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-metadata-"))
  try {
    await writeFile(join(root, "manifest.json"), JSON.stringify({ action: { default_popup: "popup.html", default_icon: "icon.png" }, options_ui: { page: "options.html" }, permissions: ["storage"], host_permissions: ["https://example.com/*"] }))
    await writeFile(join(root, "icon.png"), Buffer.from([137,80,78,71,13,10,26,10]))
    const record: BrowserExtension = { key: "test", path: root, name: "Test", version: "1", enabled: true }
    await extensionMetadata(record)
    expect(record).toMatchObject({ popup: "popup.html", optionsPage: "options.html", permissions: ["storage", "https://example.com/*"] })
    expect(record.icon).toMatch(/^data:image\/png;base64,/)
    await symlink(tmpdir(), join(root, "outside"))
    await expect(extensionFile(root, "outside")).rejects.toThrow("超出目录")
  } finally { await rm(root, { recursive: true, force: true }) }
})
