import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
import { ipcMain } from "electron"
import { withGitAuthentication } from "@main/modules/git/authentication"

const mode = vi.hoisted(() => ({ rejected: false }))
vi.mock("@main/vault/service", () => ({ readGitCredential: vi.fn(), saveGitCredential: vi.fn(), eraseGitCredential: vi.fn() }))
vi.mock("electron", async () => ({ ipcMain: new (await import("node:events")).EventEmitter() }))
vi.mock("@main/modules/git/askpass", () => ({ withGitAskpass: async (prompt: (value: string) => Promise<string | null>, action: () => Promise<unknown>, credentials: (operation: string, input: string) => Promise<string>) => {
  if (!mode.rejected) return prompt("Password for 'http://user@git.test':")
  await credentials("erase", "protocol=http\nhost=git.test\nusername=user\npassword=expired\n")
  return action()
} }))

it("accepts answers only from the requesting window and closes authentication on window destruction", async () => {
  const sender = Object.assign(new EventEmitter(), { id: 12, isDestroyed: () => false, send: vi.fn() })
  const result = withGitAuthentication(sender as unknown as WebContents, async () => "unused")
  const request = sender.send.mock.calls.find(([channel]) => channel === "git:auth-request")![1]
  expect(request.host).toBe("http://git.test")
  expect(request.password).toBe(true)
  ipcMain.emit("git:auth-response", { sender: { id: 99 } }, request.id, "wrong-window")
  expect(ipcMain.listenerCount("git:auth-response")).toBe(1)
  ipcMain.emit("git:auth-response", { sender }, request.id, "token")
  expect(await result).toBe("token")
  expect(ipcMain.listenerCount("git:auth-response")).toBe(0)
  const cancelled = withGitAuthentication(sender as unknown as WebContents, async () => "unused")
  sender.emit("destroyed")
  expect(await cancelled).toBeNull()
  expect(ipcMain.listenerCount("git:auth-response")).toBe(0)
})

it("retries once after Git rejects credentials, then surfaces a repeated failure", async () => {
  mode.rejected = true
  const sender = Object.assign(new EventEmitter(), { id: 12, isDestroyed: () => false, send: vi.fn() })
  const action = vi.fn().mockRejectedValueOnce(new Error("Authentication failed")).mockResolvedValue("updated")
  try {
    expect(await withGitAuthentication(sender as unknown as WebContents, action)).toBe("updated")
    expect(action).toHaveBeenCalledTimes(2)
    const failing = vi.fn().mockRejectedValue(new Error("still denied"))
    await expect(withGitAuthentication(sender as unknown as WebContents, failing)).rejects.toThrow("still denied")
    expect(failing).toHaveBeenCalledTimes(2)
  } finally { mode.rejected = false }
})

it("declines background authentication without opening a credential dialog", async () => {
  const sender = Object.assign(new EventEmitter(), { id: 13, isDestroyed: () => false, send: vi.fn() })
  expect(await withGitAuthentication(sender as unknown as WebContents, async () => "unused", false)).toBeNull()
  expect(sender.send).not.toHaveBeenCalled()
  expect(ipcMain.listenerCount("git:auth-response")).toBe(0)
})
