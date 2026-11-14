import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
const mock = vi.hoisted(() => ({ directory: "" }))
vi.mock("electron", () => ({ app: { getPath: () => mock.directory, once: vi.fn(), getVersion: () => "1" }, safeStorage: { isEncryptionAvailable: () => true, encryptString: (text: string) => Buffer.from(text), decryptString: (text: Buffer) => text.toString() } }))
it("migrates old settings to current icons/resources-only and persists validated theme scopes", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-icon-settings-"))
  const { fileIconTheme: _theme, fileIconWorkspace: _workspace, fileIconResources: _resources, catppuccinFlavor: _flavor, fileTypeBadgesEnabled: _badges, fileTypeBadgesWorkspace: _badgeWorkspace, fileTypeBadgesResources: _badgeResources, ...old } = defaultSettings
  try {
    await writeFile(join(mock.directory, "settings.json"), JSON.stringify({ settings: old, profiles: {} }))
    const { registerSettings } = await import("@main/settings/settings")
    const handlers = new Map<string, (...args: any[]) => any>()
    registerSettings({ ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, once: vi.fn(), send: vi.fn() } as any)
    const current = handlers.get("settings:get")!()
    expect(current.fileTypeBadgesEnabled).toBe(false)
    expect(current.fileTypeBadgesWorkspace).toBe(false)
    expect(current.fileTypeBadgesResources).toBe(true)
    expect(current.fileIconTheme).toBe("default")
    expect(current.fileIconWorkspace).toBe(false)
    expect(current.fileIconResources).toBe(true)
    const save = (patch: object) => handlers.get("settings:save")!(null, { ...current, ...patch })
    await expect(save({ fileIconTheme: "invalid" })).rejects.toThrow("图标库")
    await expect(save({ catppuccinFlavor: "invalid" })).rejects.toThrow("配色")
    await expect(save({ fileIconWorkspace: "true" })).rejects.toThrow("范围")
    await save({ fileIconTheme: "catppuccin", fileIconWorkspace: true, fileIconResources: false, catppuccinFlavor: "frappe", fileTypeBadgesEnabled: true, fileTypeBadgesWorkspace: true, fileTypeBadgesResources: false })
    const disk = JSON.parse(await readFile(join(mock.directory, "settings.json"), "utf8"))
    expect(disk.settings).toMatchObject({ fileIconTheme: "catppuccin", fileIconWorkspace: true, fileIconResources: false, catppuccinFlavor: "frappe", fileTypeBadgesEnabled: true, fileTypeBadgesWorkspace: true, fileTypeBadgesResources: false })
  } finally { await rm(mock.directory, { recursive: true, force: true }) }
})
