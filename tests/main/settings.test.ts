import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "../../src/shared/settings"
import { signedS3Request } from "../../src/main/settings-s3"
const mocks = vi.hoisted(() => ({ path: "", request: vi.fn(async () => {}), head: vi.fn(async () => undefined), upload: vi.fn(), secret: "test-secret" }))
vi.mock("electron", () => ({ app: { getPath: () => mocks.path, getVersion: () => "1.0-test", once: () => {} }, safeStorage: { isEncryptionAvailable: () => true, encryptString: () => Buffer.from("ciphertext"), decryptString: () => mocks.secret } }))
vi.mock("../../src/main/settings-s3", async original => ({ ...await original<object>(), requestS3: mocks.request, headS3File: mocks.head, uploadS3File: mocks.upload }))
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
it("isolates workspace credentials, blocks resources, and only uploads the selected allowed file", async () => {
  mocks.path = await mkdtemp(join(tmpdir(), "vessel-settings-test-"))
  const notes = join(mocks.path, "notes"), other = join(mocks.path, "other")
  await mkdir(notes); await mkdir(other)
  await writeFile(join(notes, "note.md"), "# Saved note")
  await writeFile(join(notes, "second.md"), "second")
  await writeFile(join(notes, ".env"), "private")
  await writeFile(join(other, "outside.md"), "outside")
  await symlink(join(other, "outside.md"), join(notes, "link.md"))
  const handlers = new Map<string, (...args: unknown[]) => Promise<any>>()
  const call = (name: string, ...args: unknown[]) => handlers.get(`settings:${name}`)!(null, ...args)
  try {
    const { registerSettings } = await import("../../src/main/settings")
    registerSettings({ ipc: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, callback) } } as never)
    await call("workspace", notes)
    const settings = { ...defaultSettings, name: "Test User", backup: { ...defaultSettings.backup, workspacePath: notes, enabled: true, endpoint: "https://storage.example.com", bucket: "notes", accessKey: "AKID" } }
    const saved = await call("save", settings, mocks.secret)
    expect(saved.monitorNavigation).toBe(false)
    const general = await call("save", { ...settings, monitorNavigation: true })
    expect(general.monitorNavigation).toBe(true)
    expect(JSON.parse(await readFile(join(mocks.path, "settings.json"), "utf8")).settings.monitorNavigation).toBe(true)
    expect(saved).toMatchObject({ backup: { enabled: true, workspacePath: notes, hasSecret: true } })
    expect(await readFile(join(mocks.path, "settings.json"), "utf8")).not.toContain(mocks.secret)
    mocks.upload.mockImplementation(async (...args: unknown[]) => { args[3] = await readFile(args[3] as string); return args })
    expect(await call("backup", join(notes, "note.md"), notes)).toMatchObject({ running: false, changed: 1 })
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.upload.mock.calls[0][2]).toBe("backups/note.md")
    await expect(call("backup", join(other, "outside.md"), notes)).rejects.toThrow("当前工作区")
    await expect(call("backup", join(notes, "link.md"), notes)).rejects.toThrow("当前工作区")
    await expect(call("backup", join(notes, ".env"), notes)).rejects.toThrow("排除规则")
    await call("workspace", other)
    expect(await call("get")).toMatchObject({ backup: { enabled: false, endpoint: "", hasSecret: false, workspacePath: other } })
    await expect(call("save", settings)).rejects.toThrow("工作区已切换")
    await expect(call("backup", join(notes, "note.md"), notes)).rejects.toThrow("当前页面")
    await expect(call("backup")).rejects.toThrow("开启")
    await call("workspace", notes)
    expect(await call("get")).toMatchObject({ backup: { enabled: true, endpoint: settings.backup.endpoint, hasSecret: true } })
    mocks.upload.mockClear()
    await call("backup")
    expect(mocks.upload.mock.calls.map(args => args[2]).sort()).toEqual(["backups/note.md", "backups/second.md"])
    await call("save", { ...settings, backup: { ...settings.backup, enabled: false } })
    await expect(call("backup", join(notes, "note.md"), notes)).rejects.toThrow("开启")
    await call("workspace", null)
    expect(await call("get")).toMatchObject({ backup: { enabled: false, hasSecret: false } })
    await expect(call("backup")).rejects.toThrow("当前页面")
  } finally { await rm(mocks.path, { recursive: true, force: true }) }
})
