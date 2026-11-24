import { authenticatePasswordReveal } from "./system-auth"
import { app, dialog, powerMonitor, safeStorage, type WebContents } from "electron"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { credentialOrigin, derive, salt, seal, unseal, type Sealed } from "./crypto"

type Entry = { id: string; origin: string; username: string; password: string; updated: number; kind?: "git"; gitPath?: string }
type Document = { version: 1; auto?: boolean; salt: string; wrapped: string; records: { id: string; data: Sealed }[]; never: Sealed; catalog?: string }
const aad = "vessel-vault-v1"
let key: Buffer | undefined, document: Document | undefined, loading: Promise<void> | undefined
let generation = 0, lastAttempt = 0, busy = false
let idle: ReturnType<typeof setTimeout> | undefined
const path = () => join(app.getPath("userData"), "password-vault", "vault.json")
const guests = new Map<number, { guest: WebContents; host: WebContents }>()
const candidates = new Map<string, { entry: Entry; guest: WebContents; expires: number }>()
function requireSystem() {
  if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("系统安全密钥存储不可用，已拒绝保存密码")
}
export function lockVault() {
  generation++; key?.fill(0); key = undefined; candidates.clear(); clearTimeout(idle)
}
function touch() { clearTimeout(idle); idle = setTimeout(lockVault, 5 * 60 * 1000); idle.unref() }
function requireKey(activity = true) { if (!key) throw new Error("保险库已锁定，请先解锁"); if (activity) touch(); return key }
/** Chrome-style vault: the data key is random and protected only by the OS keychain, so no master password is needed. */
let autoPending: Promise<void> | undefined
async function ensureAuto() {
  autoPending ||= (async () => {
    requireSystem()
    if (!document) {
      const created = randomBytes(32)
      try {
        const wrapped = safeStorage.encryptString(JSON.stringify({ auto: true, key: created.toString("base64") })).toString("base64")
        await persist({ version: 1, auto: true, salt: salt(), wrapped, records: [], catalog: safeStorage.encryptString("[]").toString("base64"), never: seal(created, "[]", `${aad}:never`) })
        key = Buffer.from(created)
      } finally { created.fill(0) }
    } else if (document.auto && !key) {
      const unwrapped = JSON.parse(safeStorage.decryptString(Buffer.from(document.wrapped, "base64"))) as { key?: string }
      if (typeof unwrapped.key !== "string") throw new Error("保险库无法解密")
      key = Buffer.from(unwrapped.key, "base64")
    }
  })().finally(() => { autoPending = undefined })
  await autoPending
}
async function load() {
  loading ||= (async () => {
    try {
      if ((await stat(path())).size > 16 * 1024 * 1024) throw new Error("保险库文件过大")
      const next = JSON.parse(await readFile(path(), "utf8")) as Document
      if (next?.version !== 1 || !Array.isArray(next.records) || next.records.length > 10000 || typeof next.salt !== "string" || Buffer.from(next.salt, "base64").length !== 16 || typeof next.wrapped !== "string" || !next.never) throw new Error("保险库格式无效")
      document = next
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  })().catch((error) => { loading = undefined; throw error })
  await loading
}
async function persist(next: Document) {
  // A separate OS-encrypted index allows listing websites/accounts while the
  // master-password-encrypted secrets remain locked. Never include passwords.
  if (key) {
    requireSystem()
    const metadata = next.records.map((record) => {
      const entry = JSON.parse(unseal(key!, record.data, `${aad}:${record.id}`)) as Entry
      return { id: entry.id, origin: entry.origin, username: entry.username, updated: entry.updated, ...(entry.kind === "git" ? { kind: "git", gitPath: entry.gitPath } : {}) }
    })
    next = { ...next, catalog: safeStorage.encryptString(JSON.stringify(metadata)).toString("base64") }
  }
  await mkdir(join(app.getPath("userData"), "password-vault"), { recursive: true, mode: 0o700 })
  await writeFile(path() + ".tmp", JSON.stringify(next), { mode: 0o600 })
  await rename(path() + ".tmp", path()); document = next
}
function entries(k: Buffer) { return document!.records.map((record) => JSON.parse(unseal(k, record.data, `${aad}:${record.id}`)) as Entry) }
function denied(k: Buffer): string[] { return JSON.parse(unseal(k, document!.never, `${aad}:never`)) }
async function verify(password: string) {
  requireSystem()
  if (!document) throw new Error("尚未创建保险库")
  if (document.auto) return Buffer.from(key ?? randomBytes(0))
  if (Date.now() - lastAttempt < 1500) throw new Error("请稍后重试")
  lastAttempt = Date.now()
  const derived = await derive(password, document.salt)
  try { return Buffer.from(unseal(derived, JSON.parse(safeStorage.decryptString(Buffer.from(document.wrapped, "base64"))), aad), "base64") }
  catch { throw new Error("主密码错误或保险库无法解密") }
  finally { derived.fill(0) }
}
function notify(host: WebContents, id: string) {
  const candidate = candidates.get(id)
  if (candidate && !host.isDestroyed()) host.send("vault:candidate", { id, origin: candidate.entry.origin, username: candidate.entry.username })
}
export function attachVaultGuest(guest: WebContents, host: WebContents) {
  guests.set(guest.id, { guest, host })
  guest.once("destroyed", () => { guests.delete(guest.id); for (const [id, c] of candidates) if (c.guest === guest) candidates.delete(id) })
  // Autofill suggestions: usernames only; the password is sent to the page solely after the user clicks a suggestion.
  guest.ipc.handle("vault:suggest", async (event) => {
    if (event.senderFrame !== guest.mainFrame) return []
    try {
      const origin = credentialOrigin(guest.getURL())
      await load()
      if (!document?.auto) return []
      await ensureAuto()
      return key ? entries(key).filter((entry) => entry.kind !== "git" && entry.origin === origin).map(({ id, username }) => ({ id, username })) : []
    } catch { return [] }
  })
  guest.ipc.on("vault:use", async (event, id: unknown) => {
    if (event.senderFrame !== guest.mainFrame || typeof id !== "string") return
    try {
      await load()
      if (!document?.auto) return
      await ensureAuto()
      const entry = key ? entries(key).find((item) => item.id === id) : undefined
      if (!entry || entry.kind === "git" || credentialOrigin(guest.getURL()) !== entry.origin) return
      guest.mainFrame.send("vault:fill", { origin: entry.origin, username: entry.username, password: entry.password })
    } catch { /* The page keeps its own form when the vault is unavailable. */ }
  })
  guest.ipc.on("vault:submit", async (event, value: unknown) => {
    if (event.senderFrame !== guest.mainFrame || !value || typeof value !== "object") return
    const data = value as { username?: unknown; password?: unknown }
    if (typeof data.username !== "string" || typeof data.password !== "string" || !data.password || data.password.length > 4096 || data.username.length > 1024) return
    try {
      const origin = credentialOrigin(guest.getURL())
      await load()
      if (!document || document.auto) await ensureAuto()
      if (key && (denied(key).includes(origin) || entries(key).some((entry) => entry.kind !== "git" && entry.origin === origin && entry.username === data.username && entry.password === data.password))) return
      for (const [id, c] of candidates) if (c.expires < Date.now() || c.guest === guest) candidates.delete(id)
      if (candidates.size >= 20) return
      const id = randomUUID()
      candidates.set(id, { guest, expires: Date.now() + 60000, entry: { id: randomUUID(), origin, username: data.username, password: data.password, updated: Date.now() } })
      const expiry = setTimeout(() => candidates.delete(id), 60000)
      expiry.unref()
      notify(host, id)
    } catch { /* Unsupported origins and invalid forms are not captured. */ }
  })
}
let vaultTasks: Promise<unknown> = Promise.resolve()
function vaultTask<T>(action: () => Promise<T>): Promise<T> {
  const next = vaultTasks.then(action, action)
  vaultTasks = next.catch(() => {})
  return next
}

export type GitVaultContext = { origin: string; username?: string; password?: string; path?: string }
function matchesGitEntry(entry: Entry, context: GitVaultContext) {
  return entry.kind === "git" && entry.origin === credentialOrigin(context.origin) && (entry.gitPath ?? "") === (context.path ?? "") && (context.username === undefined || entry.username === context.username)
}
async function gitVaultKey() {
  await load()
  if (!document || document.auto) await ensureAuto()
  return requireKey()
}
/** Main-process use only: Git secrets are never exposed through browser autofill IPC. */
export function readGitCredential(context: GitVaultContext) {
  return vaultTask(async () => {
    const k = await gitVaultKey()
    const found = entries(k).filter(entry => matchesGitEntry(entry, context))
    if (found.length !== 1) return undefined
    return { username: found[0].username, password: found[0].password }
  })
}
export function saveGitCredential(context: GitVaultContext) {
  return vaultTask(async () => {
    if (!context.username || !context.password || context.username.length > 1024 || context.password.length > 4096) throw new Error("无效的 Git 凭据")
    const k = await gitVaultKey()
    const existing = entries(k).find(entry => matchesGitEntry(entry, context))
    if (!existing && document!.records.length >= 10000) throw new Error("保险库记录数量超限")
    const id = existing?.id ?? randomUUID()
    const entry: Entry = { id, kind: "git", origin: credentialOrigin(context.origin), username: context.username, password: context.password, updated: Date.now(), ...(context.path ? { gitPath: context.path } : {}) }
    await persist({ ...document!, records: [...document!.records.filter(item => item.id !== id), { id, data: seal(k, JSON.stringify(entry), `${aad}:${id}`) }] })
  })
}
export function eraseGitCredential(context: GitVaultContext) {
  return vaultTask(async () => {
    if (context.username === undefined) return
    const k = await gitVaultKey()
    const rejected = new Set(entries(k).filter(entry => matchesGitEntry(entry, context) && (context.password === undefined || entry.password === context.password)).map(entry => entry.id))
    if (rejected.size) await persist({ ...document!, records: document!.records.filter(item => !rejected.has(item.id)) })
  })
}

let installed = false
export function registerVault(host: WebContents) {
  if (!installed) {
    installed = true
    powerMonitor.on("lock-screen", lockVault); powerMonitor.on("suspend", lockVault)
    app.on("before-quit", lockVault)
  }
  host.once("destroyed", lockVault)
  host.ipc.handle("vault:request", async (event, action: string, data: Record<string, string> = {}) => vaultTask(async () => {
    if (event.senderFrame !== host.mainFrame) throw new Error("不允许的保险库调用来源")
    if (!data || typeof data !== "object" || Object.values(data).some((value) => typeof value !== "string" || value.length > 4096)) throw new Error("无效的保险库参数")
    await load()
    if (action === "status") {
      if (!document) return { initialized: false, unlocked: true, auto: true }
      if (document.auto) await ensureAuto()
      return { initialized: true, unlocked: !!key, auto: !!document.auto }
    }
    if (action === "catalog") {
      if (!document) return { items: [], requiresUnlock: false }
      if (document.auto) await ensureAuto()
      requireSystem()
      if (key && !document.catalog) return { items: entries(key).map(({ password: _password, ...entry }) => entry), requiresUnlock: false }
      if (!document.catalog) return { items: [], requiresUnlock: true }
      const items: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(document.catalog, "base64")))
      if (!Array.isArray(items) || items.length > 10000 || items.some((entry) => !entry || typeof entry.id !== "string" || typeof entry.origin !== "string" || credentialOrigin(entry.origin) !== entry.origin || typeof entry.username !== "string" || typeof entry.updated !== "number")) throw new Error("账号列表无效")
      return { items: items.map(({ id, origin, username, updated, kind, gitPath }) => ({ id, origin, username, updated, ...(kind === "git" ? { kind, gitPath } : {}) })), requiresUnlock: false }
    }
    if (action === "lock") { lockVault(); return }
    if (busy) throw new Error("保险库正在处理，请稍候")
    busy = true
    try {
      if (action === "create") { await ensureAuto(); return }
      if (action === "unlock") {
        const revision = generation, decrypted = await verify(data.password)
        if (revision !== generation) { decrypted.fill(0); throw new Error("解锁已取消") }
        key?.fill(0); key = decrypted; touch()
        // One-time migration: after a successful master-password unlock the vault no longer needs it.
        const wrapped = safeStorage.encryptString(JSON.stringify({ auto: true, key: decrypted.toString("base64") })).toString("base64")
        await persist({ ...document!, auto: true, wrapped }); return
      }
      if (action === "candidate" && data.choice === "dismiss") {
        const pending = candidates.get(data.id)
        if (pending && guests.get(pending.guest.id)?.host === host) candidates.delete(data.id)
        return
      }
      if (document?.auto || !document) await ensureAuto()
      const k = requireKey(action !== "list")
      if (action === "reveal") {
        if (!entries(k).some((entry) => entry.id === data.id)) throw new Error("账号不存在")
        const revision = generation
        await authenticatePasswordReveal()
        if (host.isDestroyed() || event.senderFrame !== host.mainFrame || revision !== generation || key !== k) throw new Error("保险库已锁定，查看已取消")
        const entry = entries(k).find((entry) => entry.id === data.id)
        if (!entry) throw new Error("账号不存在")
        touch()
        return { password: entry.password }
      }
      if (action === "list") return entries(k).map(({ password: _password, ...entry }) => entry)
      if (action === "delete") { await persist({ ...document!, records: document!.records.filter((item) => item.id !== data.id) }); return }
      if (action === "candidate") {
        const candidate = candidates.get(data.id)
        if (!candidate || candidate.expires < Date.now() || candidate.guest.isDestroyed() || guests.get(candidate.guest.id)?.host !== host) throw new Error("保存请求已过期")
        candidates.delete(data.id)
        if (data.choice === "never") { await persist({ ...document!, never: seal(k, JSON.stringify([...new Set([...denied(k), candidate.entry.origin])]), `${aad}:never`) }); return }
        if (data.choice !== "save") return
        if (denied(k).includes(candidate.entry.origin)) throw new Error("该网站已设置为永不保存")
        const entry = candidate.entry
        const existing = entries(k).find((item) => item.kind !== "git" && item.origin === entry.origin && item.username === entry.username)
        entry.id = existing?.id || entry.id
        await persist({ ...document!, records: [...document!.records.filter((item) => item.id !== entry.id), { id: entry.id, data: seal(k, JSON.stringify(entry), `${aad}:${entry.id}`) }] }); return
      }
      if (action === "fill") {
        const target = guests.get(Number(data.guestId)), entry = entries(k).find((item) => item.id === data.id)
        if (!target || target.host !== host || target.guest.isDestroyed() || !entry || entry.kind === "git" || credentialOrigin(target.guest.getURL()) !== entry.origin) throw new Error("账号与当前网页来源不匹配")
        target.guest.mainFrame.send("vault:fill", { origin: entry.origin, username: entry.username, password: entry.password }); return
      }
      if (action === "import") {
        const revision = generation, check = await verify(data.password)
        check.fill(0)
        if (revision !== generation) throw new Error("保险库已锁定")
        const selected = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "加密保险库", extensions: ["json"] }] })
        if (selected.canceled || !selected.filePaths[0]) return
        const filename = selected.filePaths[0]
        if ((await stat(filename)).size > 16 * 1024 * 1024) throw new Error("备份文件过大")
        const backup = JSON.parse(await readFile(filename, "utf8"))
        if (backup.format !== "vessel-password-export" || backup.version !== 1 || backup.kdf !== "argon2id" || backup.m !== 65536 || backup.t !== 3 || backup.p !== 1 || typeof backup.salt !== "string" || Buffer.from(backup.salt, "base64").length !== 16) throw new Error("不支持的备份格式")
        const importKey = await derive(data.exportPassword, backup.salt)
        try {
          const imported: unknown = JSON.parse(unseal(importKey, backup.data, "vessel-password-export-v1"))
          if (!Array.isArray(imported) || imported.length > 10000) throw new Error("备份记录无效")
          const records = [...document!.records]
          const known = new Set(entries(k).map((entry) => JSON.stringify([entry.kind ?? "website", entry.origin, entry.username, entry.gitPath ?? ""])))
          for (const entry of imported) {
            if (!entry || typeof entry.origin !== "string" || credentialOrigin(entry.origin) !== entry.origin || typeof entry.username !== "string" || typeof entry.password !== "string" || entry.username.length > 1024 || entry.password.length > 4096 || (entry.kind !== undefined && entry.kind !== "git") || (entry.gitPath !== undefined && (typeof entry.gitPath !== "string" || entry.gitPath.length > 4096))) throw new Error("备份记录无效")
            const identity = JSON.stringify([entry.kind ?? "website", entry.origin, entry.username, entry.gitPath ?? ""])
            if (known.has(identity)) continue
            known.add(identity)
            const id = randomUUID()
            records.push({ id, data: seal(k, JSON.stringify({ id, origin: entry.origin, username: entry.username, password: entry.password, updated: Date.now(), ...(entry.kind === "git" ? { kind: "git", gitPath: entry.gitPath } : {}) }), `${aad}:${id}`) })
          }
          if (revision !== generation) throw new Error("保险库已锁定")
          if (records.length > 10000) throw new Error("保险库记录数量超限")
          await persist({ ...document!, records })
        } finally { importKey.fill(0) }
        return
      }
      if (action === "export") {
        if (!document!.auto && data.password === data.exportPassword) throw new Error("导出口令应与主密码不同")
        const revision = generation, check = await verify(data.password)
        check.fill(0)
        if (revision !== generation) throw new Error("保险库已锁定")
        const exportSalt = salt(), exportKey = await derive(data.exportPassword, exportSalt)
        try {
          if (revision !== generation) throw new Error("保险库已锁定")
          const encrypted = { format: "vessel-password-export", version: 1, kdf: "argon2id", salt: exportSalt, m: 65536, t: 3, p: 1, data: seal(exportKey, JSON.stringify(entries(k)), "vessel-password-export-v1") }
          const result = await dialog.showSaveDialog({ defaultPath: "vessel-passwords.encrypted.json", filters: [{ name: "加密保险库", extensions: ["json"] }] })
          if (!result.canceled && result.filePath) await writeFile(result.filePath, JSON.stringify(encrypted), { mode: 0o600 })
        } finally { exportKey.fill(0) }
        return
      }
      throw new Error("不支持的保险库操作")
    } finally { busy = false }
  }))
}
