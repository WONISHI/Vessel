import { expect, it, vi } from "vitest"
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "@vessel/utils"
import { signedS3Request } from "@main/sync/settings-s3"
const mocks = vi.hoisted(() => ({ path: "", request: vi.fn(async () => {}), head: vi.fn(async () => undefined), upload: vi.fn(), secret: "test-secret" }))
vi.mock("electron", () => ({ app: { getPath: () => mocks.path, getVersion: () => "1.0-test", once: () => {} }, safeStorage: { isEncryptionAvailable: () => true, encryptString: () => Buffer.from("ciphertext"), decryptString: () => mocks.secret } }))
vi.mock("@main/sync/settings-s3", async (original) => ({
  ...(await original<object>()),
  requestS3: mocks.request,
  headS3File: mocks.head,
  uploadS3File: mocks.upload,
  createS3Storage: (config, secret) => ({
    id: JSON.stringify([config.endpoint, config.bucket, config.region, config.accessKey, config.prefix]),
    list: async () => new Map(),
    download: async () => {
      throw new Error("unexpected download")
    },
    head: (key) => mocks.head(config, secret, key),
    upload: (key, source, input) => mocks.upload(config, secret, key, source, input.digest, input.size, input.etag)
  })
}))
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
  const notes = join(mocks.path, "notes"),
    other = join(mocks.path, "other")
  await mkdir(notes)
  await mkdir(other)
  await writeFile(join(notes, "note.md"), "# Saved note")
  await writeFile(join(notes, "second.md"), "second")
  await writeFile(join(notes, ".env"), "private")
  await writeFile(join(other, "outside.md"), "outside")
  await symlink(join(other, "outside.md"), join(notes, "link.md"))
  const handlers = new Map<string, (...args: unknown[]) => Promise<any>>()
  const call = (name: string, ...args: unknown[]) => handlers.get(`settings:${name}`)!(null, ...args)
  try {
    await writeFile(join(mocks.path, "settings.json"), JSON.stringify({ settings: defaultSettings, profiles: { [notes]: { config: { ...defaultSettings.backup, syncExcludeRules: "" }, secret: "", status: { running: false } } } }))
    const { registerSettings } = await import("@main/settings/settings")
    registerSettings({ ipc: { handle: (name: string, callback: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, callback) } } as never)
    await call("workspace", notes)
    expect((await call("get")).backup.syncExcludeRules).toBe("{folder:.vessel,.vscode,node-modules,.git,.obsidian,file:.DS_Store}")
    expect(defaultSettings.backup.propagateDeletes).toBe(true)
    const settings = { ...defaultSettings, name: "Test User", backup: { ...defaultSettings.backup, workspacePath: notes, enabled: true, propagateDeletes: false, endpoint: "https://storage.example.com", bucket: "notes", accessKey: "AKID" } }
    const saved = await call("save", settings, mocks.secret)
    expect(saved.monitorNavigation).toBe(false)
    const general = await call("save", { ...settings, monitorNavigation: true })
    expect(general.monitorNavigation).toBe(true)
    expect(JSON.parse(await readFile(join(mocks.path, "settings.json"), "utf8")).settings.monitorNavigation).toBe(true)
    expect(saved).toMatchObject({ backup: { enabled: true, workspacePath: notes, hasSecret: true } })
    expect(await readFile(join(mocks.path, "settings.json"), "utf8")).not.toContain(mocks.secret)
    mocks.upload.mockImplementation(async (...args: unknown[]) => {
      args[3] = await readFile(args[3] as string)
      return args
    })
    const preview = await call("preview")
    expect(preview).toMatchObject({ dryRun: true, plan: expect.arrayContaining([expect.objectContaining({ path: "note.md", action: "upload" })]) })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(await call("status")).toMatchObject({ running: false })
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
    expect(mocks.upload.mock.calls.map((args) => args[2]).sort()).toEqual(["backups/note.md", "backups/second.md"])
    expect(await call("logs")).toMatchObject({ enabled: false, entries: [] })
    await mkdir(join(notes, "d"))
    await writeFile(join(notes, "d/extra.md"), "excluded folder")
    const loggingSettings = { ...settings, backup: { ...settings.backup, logEnabled: true, syncExcludeRules: "{file:second.md;folder:d}" } }
    await expect(call("save", { ...loggingSettings, backup: { ...loggingSettings.backup, syncExcludeRules: "{file:a" } })).rejects.toThrow("排除规则")
    await call("save", loggingSettings)
    const filtered = await call("preview")
    expect(filtered.plan.map((item) => item.path)).toEqual(["note.md"])
    const diagnostic = await call("logs")
    expect(diagnostic.enabled).toBe(true)
    expect(diagnostic.entries).toContainEqual(expect.objectContaining({ type: "excluded", path: "d" }))
    expect(diagnostic.entries).toContainEqual(expect.objectContaining({ type: "excluded", path: "second.md" }))
    mocks.upload.mockRejectedValueOnce(new Error(`failure ${mocks.secret} AKID https://storage.example.com`))
    await expect(call("backup", join(notes, "note.md"), notes)).rejects.toThrow("failure")
    const encodedLogs = JSON.stringify(await call("logs"))
    expect(encodedLogs).not.toContain(mocks.secret)
    expect(encodedLogs).not.toContain("AKID")
    expect(encodedLogs).not.toContain("https://storage.example.com")
    await call("logs:clear")
    expect(await call("logs")).toMatchObject({ entries: [] })
    await call("save", { ...settings, backup: { ...settings.backup, enabled: false } })
    await expect(call("backup", join(notes, "note.md"), notes)).rejects.toThrow("开启")
    await call("workspace", null)
    expect(await call("get")).toMatchObject({ backup: { enabled: false, hasSecret: false } })
    await expect(call("backup")).rejects.toThrow("当前页面")
  } finally {
    await rm(mocks.path, { recursive: true, force: true })
  }
})
