import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { defaultDirectoryTreeSettings, defaultSettings, normalizeDirectoryTreeSettings } from "@vessel/utils"

const mock = vi.hoisted(() => ({ directory: "" }))
vi.mock("electron", () => ({ app: { getPath: () => mock.directory, once: vi.fn(), getVersion: () => "1" }, safeStorage: { isEncryptionAvailable: () => true, encryptString: (text: string) => Buffer.from(text), decryptString: (text: Buffer) => text.toString() } }))

it("fills legacy/partial settings, bounds geometry, and keeps scope values independent", () => {
  expect(normalizeDirectoryTreeSettings(undefined)).toEqual(defaultDirectoryTreeSettings)
  expect(normalizeDirectoryTreeSettings(null)).toEqual(defaultDirectoryTreeSettings)
  const settings = normalizeDirectoryTreeSettings({ layoutWorkspace: false, guidesResources: false, gapWorkspace: false,
    workspace: { sidebarWidth: 100, rowHeight: 20, fontSize: 20, indent: -8, gap: 100 },
    resources: { sidebarWidth: 400.4, rowHeight: Infinity, fontSize: "16", indent: 12, gap: 5 } })
  expect(settings).toMatchObject({ layoutWorkspace: false, layoutResources: true, guidesWorkspace: true, guidesResources: false, gapWorkspace: false, gapResources: true,
    workspace: { sidebarWidth: 232, rowHeight: 24, fontSize: 20, indent: 0, gap: 24 },
    resources: { sidebarWidth: 400, rowHeight: 22, fontSize: 13, indent: 12, gap: 5 } })
})

it("loads old settings and persists both tree scopes through the real settings IPC", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-tree-settings-"))
  try {
    const { directoryTree: _tree, ...legacy } = defaultSettings
    await writeFile(join(mock.directory, "settings.json"), JSON.stringify({ settings: legacy, profiles: {} }))
    const { registerSettings } = await import("@main/settings/settings")
    const handlers = new Map<string, (...args: any[]) => any>()
    registerSettings({ ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, once: vi.fn(), send: vi.fn() } as any)
    const current = handlers.get("settings:get")!()
    expect(current.directoryTree).toEqual(defaultDirectoryTreeSettings)
    expect(current.resourceTreeStickyScroll).toBe(true)
    const directoryTree = normalizeDirectoryTreeSettings({ layoutWorkspace: false, guidesResources: false,
      workspace: { sidebarWidth: 300, rowHeight: 26, fontSize: 14, indent: 6, gap: 4 },
      resources: { sidebarWidth: 360, rowHeight: 24, fontSize: 12, indent: 10, gap: 8 } })
    await handlers.get("settings:save")!(null, { ...current, directoryTree, resourceTreeStickyScroll: false })
    expect(handlers.get("settings:get")!().directoryTree).toEqual(directoryTree)
    expect(handlers.get("settings:get")!().resourceTreeStickyScroll).toBe(false)
    expect(JSON.parse(await readFile(join(mock.directory, "settings.json"), "utf8")).settings.directoryTree).toEqual(directoryTree)
    expect(JSON.parse(await readFile(join(mock.directory, "settings.json"), "utf8")).settings.resourceTreeStickyScroll).toBe(false)
  } finally { await rm(mock.directory, { recursive: true, force: true }) }
})
