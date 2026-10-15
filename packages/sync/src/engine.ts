import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile, writeFile, rename, mkdir, realpath, open, rm, copyFile, utimes, link } from "node:fs/promises"
import { constants } from "node:fs"
import { randomUUID } from "node:crypto"
import { join, posix, relative, isAbsolute, dirname, sep } from "node:path"
import { performance } from "node:perf_hooks"
import { SyncError, type SyncOptions, type SyncResult, type RemoteFile, type SyncPlanItem, type SyncLogEvent } from "./types.js"

type Fingerprint = { size: number; mtimeMs: number; ctimeMs: number; ino: number; dev: number }
type Entry = { size: number; digest: string; md5?: string; fingerprint?: Fingerprint; remote?: RemoteFile }
type Index = { version?: 2; target: string; files: Record<string, Entry>; hashes?: Record<string, Entry>; copies?: Record<string, Entry> }
const active = new Set<string>()
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const fingerprint = (s: Awaited<ReturnType<typeof lstat>>): Fingerprint => ({ size: Number(s.size), mtimeMs: Number(s.mtimeMs), ctimeMs: Number(s.ctimeMs), ino: Number(s.ino), dev: Number(s.dev) })
const matches = (a: Fingerprint | undefined, b: Fingerprint) => !!a && Object.keys(b).every((key) => a[key as keyof Fingerprint] === b[key as keyof Fingerprint])
export function validateKey(path: string) {
  if (!path || path.includes("\\") || path.includes("\0") || path.split("/").some((part) => !part || part === "." || part === "..")) throw new SyncError("INVALID_PATH", `同步文件路径无效：${path}`)
}
function positive(value: number, name: string, max: number) {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new RangeError(`${name} must be an integer between 1 and ${max}`)
  return value
}
async function acquireLock(path: string) {
  try {
    return await open(path, "wx", 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
  }
  // Serialize stale-owner recovery. A live owner or unidentifiable lock is never stolen.
  let recovery: Awaited<ReturnType<typeof open>>
  try {
    recovery = await open(path + ".reclaim", "wx", 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new SyncError("STATE_BUSY", "正在恢复同步索引锁")
    throw error
  }
  try {
    await recovery.writeFile(JSON.stringify({ pid: process.pid }))
    let owner: { pid?: number }
    try {
      owner = JSON.parse(await readFile(path, "utf8"))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return await open(path, "wx", 0o600)
      throw new SyncError("STATE_BUSY", "同步锁无法确定所属进程，请确认旧进程已退出")
    }
    if (!Number.isInteger(owner.pid) || owner.pid! < 1 || owner.pid! > 2147483647) throw new SyncError("STATE_BUSY", "同步锁进程标识无效")
    let dead = false
    try {
      process.kill(owner.pid!, 0)
    } catch (error) {
      dead = (error as NodeJS.ErrnoException).code === "ESRCH"
    }
    if (!dead) throw new SyncError("STATE_BUSY", "该同步索引被另一进程锁定")
    await rm(path)
    return await open(path, "wx", 0o600)
  } finally {
    await recovery.close()
    await rm(path + ".reclaim", { force: true })
  }
}
/** Plan from local, remote and previous state before applying bounded concurrent operations. */
function log(options: SyncOptions, event: SyncLogEvent) { try { options.onLog?.(event) } catch { /* Diagnostics must never stop synchronization. */ } }
export async function syncFiles(options: SyncOptions): Promise<SyncResult> {
  log(options, { type: "start", message: `${options.dryRun ? "预览" : "同步"}开始，${options.files.length} 个本地文件` })
  try {
    const result = await executeSync(options)
    log(options, { type: "finish", message: `${options.dryRun ? "预览" : "同步"}完成：上传 ${result.changed}，下载 ${result.downloaded ?? 0}，删除 ${result.deleted}，冲突 ${result.conflicts.length}，耗时 ${Math.round(result.durationMs)}ms` })
    return result
  } catch (error) {
    log(options, { type: "error", message: error instanceof Error ? error.message : "同步失败", code: error instanceof SyncError ? error.code : "SYNC_FAILED", path: error instanceof SyncError ? error.details.path : undefined })
    throw error
  }
}
async function executeSync(options: SyncOptions): Promise<SyncResult> {
  options.signal?.throwIfAborted()
  if (options.verification !== undefined && !["stat", "content"].includes(options.verification)) throw new RangeError("verification must be stat or content")
  const concurrency = positive(options.concurrency ?? 8, "concurrency", 32)
  const checkpointEvery = positive(options.checkpointEvery ?? 32, "checkpointEvery", 10000)
  const prefix = (options.prefix ?? "").replace(/^\/+|\/+$/g, "")
  if (prefix) validateKey(prefix)
  const names = new Set<string>()
  for (const file of options.files) {
    validateKey(file.path)
    if (names.has(file.path)) throw new SyncError("INVALID_PATH", `重复的同步路径：${file.path}`)
    names.add(file.path)
  }
  const indexName = options.indexName ?? "backup-files-index.json"
  validateKey(indexName)
  if (posix.basename(indexName) !== indexName || indexName.includes("\\")) throw new SyncError("INVALID_PATH", "索引文件名无效")
  await mkdir(options.stateDirectory, { recursive: true })
  // Canonicalize state paths so aliases cannot bypass the in-process single-writer guard.
  const indexPath = join(await realpath(options.stateDirectory), indexName)
  if (active.has(indexPath)) throw new SyncError("STATE_BUSY", "该同步索引正在使用")
  active.add(indexPath)
  let lock: Awaited<ReturnType<typeof open>> | undefined
  let verificationDirectory: string | undefined
  const temporaryDirectory = async () => {
    verificationDirectory ??= join(options.stateDirectory, `verify-${randomUUID()}`)
    await mkdir(verificationDirectory, { recursive: true, mode: 0o700 })
    return verificationDirectory
  }
  try {
    try {
      lock = await acquireLock(indexPath + ".lock")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new SyncError("STATE_BUSY", "该同步索引被另一进程锁定")
      throw error
    }
    await lock.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }))
    return await run(options, prefix, indexPath, concurrency, checkpointEvery, temporaryDirectory)
  } finally {
    try {
      if (lock) {
        await lock.close()
        await rm(indexPath + ".lock", { force: true })
      }
    } finally {
      try {
        if (verificationDirectory) await rm(verificationDirectory, { recursive: true, force: true })
      } finally {
        active.delete(indexPath)
      }
    }
  }
}
async function run(options: SyncOptions, prefix: string, indexPath: string, concurrency: number, checkpointEvery: number, temporaryDirectory: () => Promise<string>): Promise<SyncResult> {
  const started = performance.now(),
    storage = options.storage,
    direction = options.direction ?? "push",
    strategy = options.conflictStrategy ?? "keep-both"
  if (!["push", "pull", "bidirectional"].includes(direction) || !["keep-both", "keep-newer", "keep-larger", "error"].includes(strategy)) throw new RangeError("Invalid sync direction or conflict strategy")
  const threshold = options.deleteThresholdPercent ?? 20
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new RangeError("deleteThresholdPercent must be between 0 and 100")
  if (options.maxFileSize !== undefined && (!Number.isFinite(options.maxFileSize) || options.maxFileSize < 0)) throw new RangeError("maxFileSize must be nonnegative")
  const root = options.root ? await realpath(options.root) : undefined
  if (direction !== "push" && (!root || !storage.list || !storage.download)) throw new SyncError("UNSUPPORTED", "双向/下载同步需要工作区目录和支持列表、下载的存储适配器")
  if (options.propagateDeletes && direction !== "pull" && !storage.remove) throw new SyncError("UNSUPPORTED", "存储适配器不支持条件删除")
  const target = hash(JSON.stringify([storage.id, prefix]))
  let previous: Index = { target, files: {} }
  try {
    const saved = JSON.parse(await readFile(indexPath, "utf8")) as Index
    if (!saved || typeof saved.target !== "string" || !saved.files || typeof saved.files !== "object" || Array.isArray(saved.files)) throw new Error("Invalid receipt index")
    if (saved.version !== undefined && saved.version !== 2) throw new Error("Unsupported receipt index version")
    for (const entries of [saved.files, saved.hashes ?? {}, saved.copies ?? {}]) {
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("Invalid receipt entries")
      for (const entry of Object.values(entries)) {
        if (!entry || !Number.isFinite(entry.size) || entry.size < 0 || typeof entry.digest !== "string" || !/^[a-f0-9]{64}$/.test(entry.digest)) throw new Error("Invalid file receipt")
        if (entry.md5 !== undefined && !/^[a-f0-9]{32}$/.test(entry.md5)) throw new Error("Invalid MD5 receipt")
        if (entry.fingerprint && !["size", "mtimeMs", "ctimeMs", "ino", "dev"].every((key) => Number.isFinite(entry.fingerprint![key as keyof Fingerprint]))) throw new Error("Invalid file fingerprint")
      }
    }
    if (saved.target === target || (saved.version === undefined && saved.target === hash(storage.id))) previous = saved
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new SyncError("INVALID_STATE", "同步索引无法读取", { cause: error })
  }
  const next: Index = { version: 2, target, files: Object.assign(Object.create(null), previous.files), hashes: Object.assign(Object.create(null), previous.hashes), copies: Object.assign(Object.create(null), previous.copies) }
  const result: SyncResult = { time: "", size: 0, changed: 0, downloaded: 0, downloadSize: 0, deleted: 0, conflicts: [], skipped: [], checked: 0, hashed: 0, cached: 0, durationMs: 0, running: false }
  const activeBytes = new Map<string, number>()
  let loggedPhase: string | undefined
  const phase = (phase: "remote" | "hashing" | "planning" | "transferring", completed: number, total: number, path = "", active = false) => {
    if (loggedPhase !== phase) { loggedPhase = phase; log(options, { type: "phase", message: `执行阶段：${({ remote: "读取远端列表", hashing: "检查本地文件", planning: "生成同步计划", transferring: "执行文件同步" })[phase]}` }) }
    options.onProgress?.({ phase, active, elapsedMs: performance.now() - started, completed, total, path, uploaded: result.changed, downloaded: result.downloaded, bytes: result.size + result.downloadSize! + [...activeBytes.values()].reduce((a, b) => a + b, 0), conflicts: result.conflicts.length })
  }
  async function parallel<T>(items: readonly T[], operation: (item: T) => Promise<void>) {
    let cursor = 0,
      failure: unknown,
      failed = false
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (!failed && cursor < items.length) {
          const item = items[cursor++]
          try {
            options.signal?.throwIfAborted()
            await operation(item)
          } catch (error) {
            if (!failed) {
              failed = true
              failure = error
            }
          }
        }
      })
    )
    if (failed) throw failure
  }
  const scope = options.paths ? new Set(options.paths) : undefined
  if (scope) for (const path of scope) validateKey(path)
  const included = (path: string) => {
    if (path === ".vessel" || path.startsWith(".vessel/")) return direction === "push" && options.files.some((file) => file.path === path) && !options.excludePath?.(path, "file")
    return (!scope || scope.has(path)) && !path.split("/").some(options.exclude ?? (() => false)) && !options.excludePath?.(path, "file")
  }
  const locals = new Map<string, { source: string; entry: Entry }>()
  const keyFor = (path: string) => [prefix, path].filter(Boolean).join("/")
  const ensureSource = async (source: string) => {
    if (!root) return
    const path = relative(root, await realpath(source))
    if (!path || path === ".." || path.startsWith(".." + sep) || isAbsolute(path)) throw new SyncError("INVALID_PATH", "同步文件越出当前工作区")
  }
  const stable = async (source: string, fp: Fingerprint) => {
    await ensureSource(source)
    const value = await lstat(source)
    if (!value.isFile() || !matches(fp, fingerprint(value))) throw new SyncError("FILE_CHANGED", `同步期间文件已变化，将在下次重试：${source}`)
  }
  const hashFile = async (source: string, includeMd5 = false) => {
    const hasher = createHash("sha256")
    const md5 = includeMd5 ? createHash("md5") : undefined
    for await (const chunk of createReadStream(source, { signal: options.signal })) {
      hasher.update(chunk)
      md5?.update(chunk)
    }
    return { digest: hasher.digest("hex"), ...(md5 ? { md5: md5.digest("hex") } : {}) }
  }
  const digestFile = async (source: string) => (await hashFile(source)).digest
  let snapshot: ReadonlyMap<string, RemoteFile> | undefined
  phase("remote", 0, options.files.length)
  const listing = (async () => {
    if (!storage.list) return
    try {
      snapshot = await storage.list(prefix ? prefix + "/" : "", options.signal)
    } catch (error) {
      if (direction === "push" && error instanceof SyncError && [403, 405, 501].includes(error.details.status ?? 0)) return
      throw error
    }
  })()
  let hashedFiles = 0
  const localScan = parallel(options.files, async (file) => {
    if (!included(file.path)) return
    await ensureSource(file.source)
    if (
      root &&
      relative(root, await realpath(file.source))
        .split(sep)
        .join("/") !== file.path
    )
      throw new SyncError("INVALID_PATH", "本地文件路径与同步路径不一致")
    const stat = await lstat(file.source)
    if (!stat.isFile()) throw new SyncError("INVALID_PATH", `只能同步普通文件：${file.path}`)
    const fp = fingerprint(stat),
      cached = previous.hashes?.[file.path] ?? previous.files[file.path]
    if (options.maxFileSize && stat.size > options.maxFileSize) {
      result.skipped!.push(file.path)
      return
    }
    if (stat.size > (storage.maxObjectSize ?? Infinity)) throw new SyncError("FILE_TOO_LARGE", `文件超过存储上传限制：${file.path}`)
    let hashes: { digest: string; md5?: string }
    const needsMd5 = storage.etagContentHash === "md5" && options.verification !== "content"
    if (options.verification !== "content" && cached && matches(cached.fingerprint, fp) && (!needsMd5 || cached.md5)) {
      hashes = { digest: cached.digest, md5: cached.md5 }
      result.cached++
    } else {
      hashes = await hashFile(file.source, needsMd5)
      result.hashed++
    }
    await stable(file.source, fp)
    locals.set(file.path, { source: file.source, entry: { size: stat.size, ...hashes, fingerprint: fp } })
    phase("hashing", ++hashedFiles, options.files.length, file.path)
  })
  // Settle both branches even if one fails, before releasing the index lock.
  const preparation = await Promise.allSettled([listing, localScan])
  for (const item of preparation) if (item.status === "rejected") throw item.reason
  if (direction !== "push" && !snapshot) throw new SyncError("UNSUPPORTED", "无法取得完整远端列表，未执行双向同步")
  const remotePaths = new Set<string>()
  if (snapshot)
    for (const key of snapshot.keys()) {
      const path = prefix ? key.slice(prefix.length + 1) : key
      if (!path || path.endsWith("/") || !included(path)) continue
      validateKey(path)
      if (key !== keyFor(path)) throw new SyncError("INVALID_PATH", "远端列表路径越界")
      remotePaths.add(path)
    }
  const requests = new Map<string, Promise<RemoteFile | undefined>>()
  const remoteAt = (path: string, old?: Entry) => {
    const key = keyFor(path)
    if (requests.has(key)) return requests.get(key)!
    const request = (async () => {
      const listed = snapshot?.get(key)
      if (snapshot && !listed) return undefined
      if (listed?.digest) return listed
      if (listed?.etag && old?.remote?.etag === listed.etag && old.size === listed.size) return { ...listed, digest: old.digest }
      const local = locals.get(path)?.entry
      const etagMd5 = /^(?:"([a-f0-9]{32})"|([a-f0-9]{32}))$/i.exec(listed?.etag ?? "")
      if (storage.etagContentHash === "md5" && options.verification !== "content" && local?.md5 && local.size === listed?.size && local.md5 === (etagMd5?.[1] ?? etagMd5?.[2])?.toLowerCase()) return { ...listed!, digest: local.digest }
      if (listed && !local && !old) return listed
      result.checked++
      return storage.head(key, options.signal)
    })()
    requests.set(key, request)
    return request
  }
  type Task = SyncPlanItem & { local?: { source: string; entry: Entry }; remote?: RemoteFile; winner?: "local" | "remote" }
  const paths = new Set([...locals.keys(), ...result.skipped!])
  if (direction !== "push" || options.propagateDeletes) {
    for (const path of remotePaths) paths.add(path)
    for (const path of Object.keys(previous.files)) if (included(path)) paths.add(path)
  }
  const tasks: Task[] = []
  const prefetched = new Map<string, { source: string; remote: RemoteFile }>()
  phase("planning", 0, paths.size)
  let planned = 0
  await parallel([...paths].sort(), async (path) => {
    if (result.skipped!.includes(path)) {
      tasks.push({ path, action: "skip", reason: "文件超过大小限制" })
      return
    }
    const local = locals.get(path),
      old = previous.files[path]
    let remote = await remoteAt(path, old)
    // Missing provider-specific metadata is unknown content, not evidence of conflict.
    // Verify unknown content once and reuse these exact bytes if the plan later downloads it.
    if (local && remote && !remote.digest && remote.etag && storage.download && !(options.maxFileSize && (remote.size ?? 0) > options.maxFileSize)) {
      const source = join(await temporaryDirectory(), randomUUID())
      let downloaded: RemoteFile
      try {
        downloaded = await storage.download(keyFor(path), source, {
          etag: remote.etag,
          signal: options.signal,
          onProgress: (bytes) => {
            activeBytes.set(path, bytes)
            phase("planning", planned, paths.size, path, true)
          }
        })
      } finally {
        activeBytes.delete(path)
      }
      const hashes = await hashFile(source),
        size = (await lstat(source)).size
      if ((remote.size !== undefined && remote.size !== size) || (downloaded.etag && remote.etag !== downloaded.etag) || (downloaded.digest && downloaded.digest !== hashes.digest)) throw new SyncError("REMOTE_CONFLICT", `远端内容校验失败：${path}`)
      remote = { ...remote, ...downloaded, digest: hashes.digest, size }
      prefetched.set(path, { source, remote })
      result.verified = (result.verified ?? 0) + 1
      result.downloadSize! += size
    }
    const task: Task = { path, local, remote, action: "equal", reason: "内容一致" }
    if (options.maxFileSize && (remote?.size ?? 0) > options.maxFileSize) {
      task.action = "skip"
      task.reason = "远端文件超过大小限制"
      result.skipped!.push(path)
    } else if (local && remote) {
      if (remote.digest === local.entry.digest) {
        /* equality establishes the shared baseline */
      } else {
        const localChanged = !old || local.entry.digest !== old.digest,
          remoteChanged = !old || remote.digest !== old.digest
        if (!remoteChanged && direction !== "pull") {
          task.action = "upload"
          task.reason = "本地修改"
        } else if (!localChanged && direction !== "push") {
          task.action = "download"
          task.reason = "远端修改"
        } else if (direction === "pull" && !remoteChanged) {
          task.action = "skip"
          task.reason = "仅本地变化，下载模式保留本地"
        } else if (direction === "push" && strategy === "keep-both") {
          task.action = "conflict"
          task.reason = "保留远端原文件并备份本地副本"
        } else {
          task.action = "conflict"
          task.reason = "双方内容不同"
          if (strategy === "keep-newer") task.winner = local.entry.fingerprint!.mtimeMs > (remote.modifiedMs ?? 0) ? "local" : "remote"
          if (strategy === "keep-larger") task.winner = local.entry.size > (remote.size ?? 0) ? "local" : "remote"
        }
      }
    } else if (local) {
      if (old && local.entry.digest === old.digest && options.propagateDeletes && direction !== "push") {
        task.action = "delete-local"
        task.reason = "远端已删除，本地未变化"
      } else if (direction !== "pull") {
        task.action = "upload"
        task.reason = "本地新增或保留本地修改"
      } else {
        task.action = "skip"
        task.reason = "下载模式保留仅本地文件"
      }
    } else if (remote) {
      if (old && remote.digest === old.digest && options.propagateDeletes && direction !== "pull") {
        task.action = "delete-remote"
        task.reason = "本地已删除，远端未变化"
      } else if (direction !== "push") {
        task.action = "download"
        task.reason = "远端新增或保留远端修改"
      } else {
        task.action = "skip"
        task.reason = "上传模式保留仅远端文件"
      }
    } else {
      task.reason = "双方均不存在"
    }
    tasks.push(task)
    phase("planning", ++planned, paths.size, path)
  })
  tasks.sort((a, b) => a.path.localeCompare(b.path))
  const publicPlan = tasks.map(({ path, action, reason }) => ({ path, action, reason }))
  const deletes = tasks.filter((task) => task.action.startsWith("delete-")).length
  const protectedDeletion = deletes > 0 && threshold < 100 && deletes * 100 > tasks.length * threshold
  options.signal?.throwIfAborted()
  if (options.dryRun) {
    result.plan = publicPlan
    result.dryRun = true
    result.conflicts = tasks.filter((task) => task.action === "conflict").map((task) => task.path)
    result.time = new Date().toISOString()
    result.durationMs = performance.now() - started
    return result
  }
  if (protectedDeletion) throw new SyncError("DELETE_PROTECTION", `计划删除 ${deletes}/${tasks.length} 个文件，超过 ${threshold}% 保护阈值；请先预览同步计划`)
  if (strategy === "error" && tasks.some((task) => task.action === "conflict")) throw new SyncError("REMOTE_CONFLICT", `发现冲突，未执行同步：${tasks.find((task) => task.action === "conflict")!.path}`)
  let dirty = 0,
    completed = 0,
    writes: Promise<void> = Promise.resolve()
  const record = (path: string, entry?: Entry, canonical = true) => {
    if (entry?.remote) entry = { ...entry, remote: { digest: entry.digest, etag: entry.remote.etag ?? null, size: entry.size, ...(Number.isFinite(entry.remote.modifiedMs) ? { modifiedMs: entry.remote.modifiedMs } : {}) } }
    const entries = canonical ? next.files : next.hashes!
    if (JSON.stringify(entries[path]) !== JSON.stringify(entry)) {
      if (entry) entries[path] = entry
      else delete entries[path]
      dirty++
    }
    if (canonical && next.hashes![path]) {
      delete next.hashes![path]
      dirty++
    }
  }
  const flush = () => {
    if (!dirty) return writes
    const json = JSON.stringify(next)
    dirty = 0
    writes = writes.then(async () => {
      await writeFile(indexPath + ".tmp", json, { mode: 0o600 })
      await rename(indexPath + ".tmp", indexPath)
    })
    return writes
  }
  const upload = async (path: string, source: string, entry: Entry, remote?: RemoteFile) => {
    if (remote && !remote.etag) throw new SyncError("REMOTE_CONFLICT", `远端缺少版本标识，未覆盖：${path}`)
    await stable(source, entry.fingerprint!)
    let uploaded: RemoteFile | void
    try {
      uploaded = await storage.upload(keyFor(path), source, {
        digest: entry.digest,
        size: entry.size,
        modifiedMs: entry.fingerprint?.mtimeMs,
        sourceVersion: entry.fingerprint,
        etag: remote?.etag ?? undefined,
        signal: options.signal,
        onProgress: (bytes) => {
          activeBytes.set(path, bytes)
          phase("transferring", completed, transferCount, path, true)
        }
      })
    } finally {
      activeBytes.delete(path)
    }
    result.size += entry.size
    result.changed++
    await stable(source, entry.fingerprint!)
    return { ...entry, remote: uploaded || undefined }
  }
  const destinationFor = async (path: string) => {
    if (!root) throw new SyncError("UNSUPPORTED", "下载需要本地工作区目录")
    validateKey(path)
    if (process.platform === "win32" && path.split("/").some((part) => /[:<>"|?*]|[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new SyncError("INVALID_PATH", `下载路径在 Windows 中无效：${path}`)
    let parent = root
    // Resolve each parent before creating children: never traverse symlinks or junctions outside root.
    const segments = path.split("/")
    for (const part of segments.slice(0, -1)) {
      parent = join(parent, part)
      try {
        await mkdir(parent)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      }
      const actual = await realpath(parent),
        relativePath = relative(root, actual)
      if (relativePath === ".." || relativePath.startsWith(".." + sep) || isAbsolute(relativePath)) throw new SyncError("INVALID_PATH", "下载目录越出工作区")
      if ((await lstat(parent)).isSymbolicLink()) throw new SyncError("INVALID_PATH", "下载目录不能是符号链接")
    }
    return join(parent, segments.at(-1)!)
  }
  const pull = async (task: Task) => {
    if (!task.remote?.etag || !storage.download) throw new SyncError("REMOTE_CONFLICT", `无法安全下载远端文件：${task.path}`)
    const destination = await destinationFor(task.path),
      temporary = join(dirname(destination), `.vessel-download-${randomUUID()}.tmp`)
    try {
      let downloaded: RemoteFile
      const verified = prefetched.get(task.path)
      if (verified) {
        await copyFile(verified.source, temporary, constants.COPYFILE_EXCL)
        downloaded = verified.remote
      } else
        try {
          downloaded = await storage.download(keyFor(task.path), temporary, {
            etag: task.remote.etag,
            signal: options.signal,
            onProgress: (bytes) => {
              activeBytes.set(task.path, bytes)
              phase("transferring", completed, transferCount, task.path, true)
            }
          })
        } finally {
          activeBytes.delete(task.path)
        }
      const digest = await digestFile(temporary),
        size = (await lstat(temporary)).size
      if (downloaded.digest && downloaded.digest !== digest) throw new SyncError("REMOTE_CONFLICT", `下载内容校验失败：${task.path}`)
      if (task.remote.digest && task.remote.digest !== digest) throw new SyncError("REMOTE_CONFLICT", `远端下载内容与计划不一致：${task.path}`)
      if (downloaded.etag && downloaded.etag !== task.remote.etag) throw new SyncError("REMOTE_CONFLICT", `远端在下载期间变化：${task.path}`)
      if (task.remote.size !== undefined && task.remote.size !== size) throw new SyncError("REMOTE_CONFLICT", `下载文件长度不一致：${task.path}`)
      options.signal?.throwIfAborted()
      if (task.local) {
        await stable(task.local.source, task.local.entry.fingerprint!)
        await rename(temporary, destination)
      } else {
        await link(temporary, destination)
        await rm(temporary)
      } // Atomic create-only, never replace a newly created local file.
      if (Number.isFinite(task.remote.modifiedMs)) await utimes(destination, new Date(), new Date(task.remote.modifiedMs!))
      const fp = fingerprint(await lstat(destination))
      record(task.path, { digest, size, fingerprint: fp, remote: { ...task.remote, ...downloaded, digest, size } })
      result.downloaded!++
      if (!verified) result.downloadSize! += size
    } finally {
      await rm(temporary, { force: true })
    }
  }
  const transferCount = tasks.filter((task) => task.action !== "equal" && task.action !== "skip").length
  phase("transferring", 0, transferCount)
  let failure: unknown,
    failed = false
  try {
    await parallel(tasks, async (task) => {
      const transfers = task.action !== "equal" && task.action !== "skip"
      if (transfers) phase("transferring", completed, transferCount, task.path, true)
      if (task.action === "upload") record(task.path, await upload(task.path, task.local!.source, task.local!.entry, task.remote))
      else if (task.action === "download") await pull(task)
      else if (task.action === "delete-remote") {
        if (!task.remote?.etag) throw new SyncError("REMOTE_CONFLICT", `删除缺少远端版本标识：${task.path}`)
        // Verify local absence again immediately before a remote deletion.
        if (root) {
          try {
            await lstat(join(root, task.path))
            throw new SyncError("FILE_CHANGED", `本地文件重新出现：${task.path}`)
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
          }
        }
        await storage.remove!(keyFor(task.path), { etag: task.remote.etag, signal: options.signal })
        record(task.path)
        result.deleted++
      } else if (task.action === "delete-local") {
        // Recheck remote absence and preserve the local file in a recoverable workspace trash on the same filesystem.
        if (await storage.head(keyFor(task.path), options.signal)) throw new SyncError("REMOTE_CONFLICT", `远端文件重新出现：${task.path}`)
        await stable(task.local!.source, task.local!.entry.fingerprint!)
        const trash = await destinationFor(`.vessel/trash/${randomUUID()}/${task.path}`)
        await mkdir(dirname(trash), { recursive: true })
        await rename(task.local!.source, trash)
        record(task.path)
        result.deleted++
      } else if (task.action === "conflict") {
        result.conflicts.push(task.path)
        if (task.winner) {
          if (task.winner === "local" && direction !== "pull") record(task.path, await upload(task.path, task.local!.source, task.local!.entry, task.remote))
          else if (task.winner === "remote" && direction !== "push") await pull(task)
        } else {
          const local = task.local!,
            extension = posix.extname(task.path),
            stem = task.path.slice(0, task.path.length - extension.length)
          const copyPath = direction === "push" ? `.vessel/conflicts/${stem}.conflict-${local.entry.digest}${extension}` : `${stem}.conflict-local-${local.entry.digest}${extension}`
          const existing = await remoteAt(copyPath, next.copies![copyPath])
          if (direction !== "pull" && existing?.digest !== local.entry.digest) {
            if (existing) throw new SyncError("REMOTE_CONFLICT", `冲突副本已被占用：${copyPath}`)
            const receipt = await upload(copyPath, local.source, local.entry)
            next.copies![copyPath] = { ...receipt, remote: receipt.remote ? { digest: receipt.digest, etag: receipt.remote.etag ?? null, size: receipt.size } : undefined }
            dirty++
          }
          if (direction !== "push") {
            const destination = await destinationFor(copyPath)
            await stable(local.source, local.entry.fingerprint!)
            try {
              await copyFile(local.source, destination, constants.COPYFILE_EXCL)
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "EEXIST" || (await digestFile(destination)) !== local.entry.digest) throw error
            }
            if (direction !== "pull") record(copyPath, { ...local.entry, fingerprint: fingerprint(await lstat(destination)), remote: next.copies![copyPath]?.remote ?? existing })
            await pull(task)
          } else record(task.path, local.entry, false)
        }
      } else if (task.action === "equal") {
        if (task.local && task.remote) record(task.path, { ...task.local.entry, remote: task.remote })
        else if (!task.local && !task.remote) record(task.path)
      }
      if (transfers) completed++
      // Adopting thousands of unchanged legacy objects changes only receipts. Persist
      // those together, rather than rewriting the whole index after each small batch.
      if (transfers && dirty >= checkpointEvery) await flush()
      if (transfers) { log(options, { type: "operation", path: task.path, action: task.action, message: task.reason }); phase("transferring", completed, transferCount, task.path) }
    })
  } catch (error) {
    failed = true
    failure = error
  }
  await flush()
  result.time = new Date().toISOString()
  result.durationMs = performance.now() - started
  result.conflicts.sort()
  result.skipped!.sort()
  if (failed) {
    if (failure instanceof SyncError) throw new SyncError(failure.code, failure.message, { ...failure.details, result, cause: failure })
    if (options.signal?.aborted) throw options.signal.reason
    throw new SyncError("SYNC_FAILED", failure instanceof Error ? failure.message : "同步失败", { result, cause: failure })
  }
  options.signal?.throwIfAborted()
  return result
}
