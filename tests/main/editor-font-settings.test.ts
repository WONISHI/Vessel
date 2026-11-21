import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
const mock = vi.hoisted(() => ({ directory: "" }))
vi.mock("electron", () => ({ app: { getPath: () => mock.directory, once: vi.fn(), getVersion: () => "1" }, safeStorage: { isEncryptionAvailable: () => true, encryptString: (text: string) => Buffer.from(text), decryptString: (text: Buffer) => text.toString() } }))
it("migrates, validates and persists editor typography independently from interface typography", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-editor-font-"))
  const { editorFont: _font, editorFontSize: _size, ...old } = defaultSettings
  try {
    await writeFile(join(mock.directory, "settings.json"), JSON.stringify({ settings: old, profiles: {} }))
    const { registerSettings } = await import("@main/settings/settings")
    const handlers = new Map<string, (...args: any[]) => any>()
    registerSettings({ ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, once: vi.fn(), send: vi.fn() } as any)
    const current = handlers.get("settings:get")!()
    expect(current).toMatchObject({ editorFont: "Menlo", editorFontSize: 14 })
    const save = (patch: object) => handlers.get("settings:save")!(null, { ...current, ...patch })
    for (const editorFontSize of [9, 33, 12.5, NaN]) await expect(save({ editorFontSize })).rejects.toThrow("编辑器字体大小")
    await expect(save({ editorFont: "invalid" })).rejects.toThrow("编辑器字体无效")
    await save({ editorFont: "JetBrains Mono", editorFontSize: 22 })
    expect(JSON.parse(await readFile(join(mock.directory, "settings.json"), "utf8")).settings).toMatchObject({ editorFont: "JetBrains Mono", editorFontSize: 22, font: old.font, fontSize: old.fontSize })
  } finally { await rm(mock.directory, { recursive: true, force: true }) }
})
