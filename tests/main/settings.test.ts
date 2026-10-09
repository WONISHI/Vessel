import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import Database from "better-sqlite3"
import { defaultSettings } from "../../src/shared/settings"
import { signedS3Request } from "../../src/main/settings-s3"
const mocks = vi.hoisted(() => ({ path: "", request: vi.fn(async () => {}), secret: "test-secret" }))
vi.mock("electron", () => ({ app: { getPath: () => mocks.path, getVersion: () => "1.0-test", once: () => {} }, safeStorage: { isEncryptionAvailable: () => true, encryptString: () => Buffer.from("ciphertext"), decryptString: () => mocks.secret } }))
vi.mock("../../src/main/settings-s3", async original => ({ ...await original<object>(), requestS3: mocks.request }))
it("signs S3 paths deterministically and rejects credentials embedded in endpoint URLs", () => {
  const config = { ...defaultSettings.backup, endpoint: "https://storage.example.com", bucket: "notes", accessKey: "AKID", region: "us-east-1" }
  const request = signedS3Request(config, "secret", "PUT", "中文/my file.json", new Uint8Array([1, 2]), new Date("2026-10-03T00:00:00Z"))
  expect(signedS3Request({ ...config, endpoint: "storage.example.com" }, "secret", "HEAD").url).toBe("https://storage.example.com/notes")
  const cos = { ...config, endpoint: "cos.ap-guangzhou.myqcloud.com", bucket: "notes-123456", region: "ap-guangzhou" }
  expect(signedS3Request(cos, "secret", "HEAD").url).toBe("https://notes-123456.cos.ap-guangzhou.myqcloud.com/")
  expect(signedS3Request({ ...cos, endpoint: "https://notes-123456.cos.ap-guangzhou.myqcloud.com" }, "secret", "PUT", "backup.json").url).toBe("https://notes-123456.cos.ap-guangzhou.myqcloud.com/backup.json")
  expect(request.url).toBe("https://storage.example.com/notes/%E4%B8%AD%E6%96%87/my%20file.json")
  expect(request.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/20261003\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[a-f0-9]{64}$/)
  expect(request.headers["x-amz-date"]).toBe("20261003T000000Z")
  expect(() => signedS3Request({ ...config, endpoint: "https://secret@example.com" }, "secret", "HEAD")).toThrow("Endpoint")
})
it("persists encrypted credentials, validates intervals, and snapshots SQLite plus workspace notes without the secret", async () => {
  mocks.path = await mkdtemp(join(tmpdir(), "vessel-settings-test-"))
  const notes = join(mocks.path, "notes"); await mkdir(notes); await writeFile(join(notes, "note.md"), "# Saved note")
  const db = new Database(join(mocks.path, "vessel.db"))
  db.exec("CREATE TABLE workspaces(path TEXT); CREATE TABLE app_state(key TEXT, value_json TEXT)")
  db.prepare("INSERT INTO workspaces VALUES (?)").run(notes); db.close()
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  try {
    const { registerSettings } = await import("../../src/main/settings")
    registerSettings({ ipc: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, callback) } } as never)
    const settings = { ...defaultSettings, name: "Test User", backup: { ...defaultSettings.backup, endpoint: "https://storage.example.com", bucket: "notes", accessKey: "AKID" } }
    const saved = await handlers.get("settings:save")!(null, settings, mocks.secret)
    expect(saved).toMatchObject({ name: "Test User", backup: { hasSecret: true, secretLength: mocks.secret.length } })
    expect(await readFile(join(mocks.path, "settings.json"), "utf8")).not.toContain(mocks.secret)
    await expect(handlers.get("settings:save")!(null, { ...settings, backup: { ...settings.backup, minutes: 15 } })).rejects.toThrow("选项")
    const status = await handlers.get("settings:backup")!()
    expect(status).toMatchObject({ running: false })
    const args = mocks.request.mock.calls.at(-1) as unknown as unknown[]
    expect(args[2]).toBe("PUT")
    const archive = JSON.parse(Buffer.from(args[4] as Uint8Array).toString())
    expect(Object.keys(archive.files).includes("database/vessel.db")).toBe(true)
    const note = archive.files[Object.keys(archive.files).find(path => path.endsWith("/note.md"))!]
    const blob = (mocks.request.mock.calls as unknown as unknown[][]).find(call => String(call[3]).endsWith(note.chunks[0]))!
    expect(Buffer.from(blob[4] as Uint8Array).toString()).toBe("# Saved note")
    expect(JSON.stringify(archive)).not.toContain(mocks.secret)
    mocks.request.mockRejectedValueOnce(new Error("storage unavailable"))
    await expect(handlers.get("settings:backup")!()).rejects.toThrow("storage unavailable")
    expect(await handlers.get("settings:status")!()).toMatchObject({ running: false, error: "storage unavailable" })
  } finally { await rm(mocks.path, { recursive: true, force: true }) }
})
