import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ directory: "", exported: "", handlers: new Map<string, (...args: any[]) => any>(), guestHandlers: new Map<string, (...args: any[]) => any>(), send: vi.fn(), fill: vi.fn(), system: true, authenticate: vi.fn().mockResolvedValue(undefined) }))
vi.mock("electron", () => ({
  app: { getPath: () => mock.directory, on: vi.fn() }, powerMonitor: { on: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => mock.system, getSelectedStorageBackend: () => "gnome_libsecret", encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString() },
  dialog: { showSaveDialog: async () => ({ canceled: false, filePath: mock.exported }), showOpenDialog: async () => ({ canceled: false, filePaths: [mock.exported] }) }
}))
vi.mock("@main/vault/system-auth", () => ({ authenticatePasswordReveal: mock.authenticate }))
import { attachVaultGuest, lockVault, registerVault } from "@main/vault/service"
it("protects the vault lifecycle, validates IPC and isolates credentials by origin", async () => {
  mock.directory = await mkdtemp(join(tmpdir(), "vessel-vault-test-")); mock.exported = join(mock.directory, "backup.json")
  const frame = {}, guestFrame = { send: mock.fill }
  const host = { mainFrame: frame, ipc: { handle: (name: string, fn: any) => mock.handlers.set(name, fn) }, once: vi.fn(), send: mock.send, isDestroyed: () => false }
  let url = "https://example.test/login"
  const guest = { id: 1, mainFrame: guestFrame, ipc: { on: (name: string, fn: any) => mock.guestHandlers.set(name, fn), handle: (name: string, fn: any) => mock.guestHandlers.set(name, fn) }, once: vi.fn(), isDestroyed: () => false, getURL: () => url }
  registerVault(host as never); attachVaultGuest(guest as never, host as never)
  let now = 10000
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now)
  const request = (action: string, data = {}) => { now += 2000; return mock.handlers.get("vault:request")!({ senderFrame: frame }, action, data) }
  try {
    await expect(mock.handlers.get("vault:request")!({ senderFrame: {} }, "status")).rejects.toThrow("来源")
    expect(await request("status")).toEqual({ initialized: false, unlocked: true, auto: true })
    expect(await request("catalog")).toEqual({ items: [], requiresUnlock: false })
    mock.system = false
    await expect(request("create")).rejects.toThrow("系统")
    mock.system = true
    // No master password: the first captured login creates the OS-keychain-protected vault.
    await mock.guestHandlers.get("vault:submit")!({ senderFrame: guestFrame }, { username: "private-user", password: "private-site-secret" })
    const candidate = mock.send.mock.calls.at(-1)![1]
    expect(candidate).not.toHaveProperty("password")
    await request("candidate", { id: candidate.id, choice: "save" })
    expect(await request("status")).toEqual({ initialized: true, unlocked: true, auto: true })
    const disk = await readFile(join(mock.directory, "password-vault/vault.json"), "utf8")
    for (const secret of ["private-user", "private-site-secret", "https://example.test"]) expect(disk).not.toContain(secret)
    const [entry] = await request("list")
    expect(entry.username).toBe("private-user"); expect(entry).not.toHaveProperty("password")
    mock.authenticate.mockRejectedValueOnce(new Error("系统身份验证已取消"))
    await expect(request("reveal", { id: entry.id })).rejects.toThrow("取消")
    expect(await request("reveal", { id: entry.id })).toEqual({ password: "private-site-secret" })
    expect(mock.authenticate).toHaveBeenCalledTimes(2)
    // Locking (screen lock, idle) never asks for a password: the key is restored from the OS keychain.
    lockVault()
    expect(await request("list")).toHaveLength(1)
    url = "https://other.test/"
    await expect(request("fill", { id: entry.id, guestId: "1" })).rejects.toThrow("来源")
    expect(mock.fill).not.toHaveBeenCalled()
    url = "https://example.test/login"
    await request("fill", { id: entry.id, guestId: "1" })
    expect(mock.fill).toHaveBeenCalledWith("vault:fill", expect.objectContaining({ password: "private-site-secret" }))
    // Focusing a login field suggests saved usernames for this origin only; the password is sent after the user picks one.
    const suggestions = await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })
    expect(suggestions).toEqual([{ id: entry.id, username: "private-user" }])
    expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: {} })).toEqual([])
    mock.fill.mockClear()
    await mock.guestHandlers.get("vault:use")!({ senderFrame: guestFrame }, entry.id)
    expect(mock.fill).toHaveBeenCalledWith("vault:fill", expect.objectContaining({ password: "private-site-secret" }))
    url = "https://other.test/"
    expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })).toEqual([])
    url = "https://example.test/login"
    // Identical credentials are not offered again.
    const previousPrompts = mock.send.mock.calls.length
    await mock.guestHandlers.get("vault:submit")!({ senderFrame: guestFrame }, { username: "private-user", password: "private-site-secret" })
    expect(mock.send.mock.calls.length).toBe(previousPrompts)
    await request("export", { exportPassword: "another export password" })
    expect(await readFile(mock.exported, "utf8")).not.toContain("private-site-secret")
    await request("delete", { id: entry.id })
    expect(await request("list")).toHaveLength(0)
    await request("import", { exportPassword: "another export password" })
    expect(await request("list")).toHaveLength(1)
    // Local development has the same consent flow and keeps protocol, host and port boundaries.
    url = "http://localhost:9525/login"
    const localPrompts = mock.send.mock.calls.length
    await mock.guestHandlers.get("vault:submit")!({ senderFrame: guestFrame }, { username: "local-user", password: "local-dummy-secret" })
    expect(mock.send.mock.calls.length).toBe(localPrompts + 1)
    const localCandidate = mock.send.mock.calls.at(-1)![1]
    expect(localCandidate.origin).toBe("http://localhost:9525")
    expect(localCandidate).not.toHaveProperty("password")
    expect(await request("list")).toHaveLength(1)
    await request("candidate", { id: localCandidate.id, choice: "save" })
    const localEntry = (await request("list")).find((item: { origin: string }) => item.origin === "http://localhost:9525")
    expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })).toEqual([{ id: localEntry.id, username: "local-user" }])
    for (const other of ["http://localhost:9523/login", "http://127.0.0.1:9525/login", "https://localhost:9525/login"]) {
      url = other
      expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })).toEqual([])
      await expect(request("fill", { id: localEntry.id, guestId: "1" })).rejects.toThrow("来源")
    }
    url = "http://39.106.89.88:8090/users/sign_in"
    const remotePrompts = mock.send.mock.calls.length
    await mock.guestHandlers.get("vault:submit")!({ senderFrame: guestFrame }, { username: "remote-user", password: "remote-dummy-secret" })
    expect(mock.send.mock.calls.length).toBe(remotePrompts + 1)
    const httpCandidate = mock.send.mock.calls.at(-1)![1]
    expect(httpCandidate.origin).toBe("http://39.106.89.88:8090")
    expect(httpCandidate).not.toHaveProperty("password")
    await request("candidate", { id: httpCandidate.id, choice: "save" })
    const httpEntry = (await request("list")).find((item: { origin: string }) => item.origin === httpCandidate.origin)
    expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })).toEqual([{ id: httpEntry.id, username: "remote-user" }])
    for (const other of ["http://39.106.89.88:8091/users/sign_in", "https://39.106.89.88:8090/users/sign_in", "http://39.106.89.89:8090/users/sign_in"]) {
      url = other
      expect(await mock.guestHandlers.get("vault:suggest")!({ senderFrame: guestFrame })).toEqual([])
      await expect(request("fill", { id: httpEntry.id, guestId: "1" })).rejects.toThrow("来源")
    }
  } finally { lockVault(); clock.mockRestore(); await rm(mock.directory, { recursive: true, force: true }) }
}, 60000)
