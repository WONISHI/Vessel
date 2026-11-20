import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"

const mock = vi.hoisted(() => ({ directory: "" }))
vi.mock("electron", () => ({ app: { getPath: () => mock.directory, once: vi.fn(), getVersion: () => "1" }, safeStorage: { isEncryptionAvailable: () => true } }))

it("defaults legacy profiles to independent consoles and persists the follow option through settings IPC", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-devtools-settings-"))
  try {
    const { browserDevtoolsFollowWindow: _follow, ...legacy } = defaultSettings
    await writeFile(join(mock.directory, "settings.json"), JSON.stringify({ settings: legacy, profiles: {} }))
    const { registerSettings } = await import("@main/settings/settings")
    const handlers = new Map<string, (...args: any[]) => any>()
    registerSettings({ ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, once: vi.fn(), send: vi.fn() } as any)
    const current = handlers.get("settings:get")!()
    expect(current.browserDevtoolsFollowWindow).toBe(false)
    const save = (value: unknown) => handlers.get("settings:save")!(null, { ...current, browserDevtoolsFollowWindow: value })
    await expect(save("true")).rejects.toThrow("控制台窗口跟随设置无效")
    await expect(save(true)).resolves.toMatchObject({ browserDevtoolsFollowWindow: true })
    expect(JSON.parse(await readFile(join(mock.directory, "settings.json"), "utf8")).settings.browserDevtoolsFollowWindow).toBe(true)
    await save(false)
    expect(handlers.get("settings:get")!().browserDevtoolsFollowWindow).toBe(false)
  } finally { await rm(mock.directory, { recursive: true, force: true }) }
})
