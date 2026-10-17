import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@vessel/utils"
const state = vi.hoisted(() => ({ path: "" }))
vi.mock("electron", () => ({
  app: { getPath: () => state.path, once: vi.fn(), getVersion: () => "1" },
  safeStorage: {
    decryptString: () => {
      throw new Error("ciphertext invalid")
    },
    isEncryptionAvailable: () => true,
    encryptString: (text: string) => Buffer.from(text)
  }
}))
it("keeps appearance settings readable and savable when the existing backup secret cannot decrypt", async () => {
  state.path = await mkdtemp(join(tmpdir(), "vessel-secret-recovery-"))
  const root = join(state.path, "vault")
  const ciphertext = Buffer.from("original encrypted bytes").toString("base64")
  try {
    await writeFile(join(state.path, "settings.json"), JSON.stringify({ settings: defaultSettings, secret: ciphertext, profiles: { [root]: { config: defaultSettings.backup, secret: ciphertext, status: { running: false } } } }))
    const { registerSettings } = await import("@main/settings/settings")
    const handlers = new Map<string, (...args: any[]) => any>()
    registerSettings({ ipc: { handle: (name: string, callback: (...args: any[]) => any) => handlers.set(name, callback) }, once: vi.fn(), send: vi.fn() } as any)
    handlers.get("settings:workspace")!(null, root)
    const settings = handlers.get("settings:get")!()
    expect(settings.backup.secretUnavailable).toBe(true)
    expect(settings.backup.hasSecret).toBe(true)
    const saved = await handlers.get("settings:save")!(null, { ...settings, theme: "dark" })
    expect(saved.theme).toBe("dark")
    const disk = JSON.parse(await readFile(join(state.path, "settings.json"), "utf8"))
    expect(disk.profiles[root].secret).toBe(ciphertext)
  } finally {
    await rm(state.path, { recursive: true, force: true })
  }
})
