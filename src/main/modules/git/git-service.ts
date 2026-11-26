import { StashRestoreHistory } from "./stash-restore-history"
import type { GitStashRestoreRecord, GitFetchOptions, GitPullOptions, GitPushInfo, GitPushSelection, GitTagOptions, GitCommitDetail, GitCommitItem, GitDiffResult, GitFileStatus, GitStatusResult, GitStashPopResult, GitStashEntry, GitStashFile, GitStashDetail } from "@vessel/type/git"
import { gitAuthenticationEnvironment } from "./askpass"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { lstat, readFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { runCancellableGit } from "./cancellable-git"
export type { GitCommitDetail, GitCommitItem, GitDiffResult, GitFileStatus, GitStatusResult } from "@vessel/type/git"

// Only user-facing history roots; --all also includes refs/stash and other internal refs.
const HISTORY_REVISIONS = ["--branches", "--remotes", "--tags", "HEAD"]
// Show what a commit introduced to its branch, including changes brought in by merges.
const COMMIT_DIFF_OPTIONS = ["--diff-merges=first-parent", "--no-ext-diff", "--no-textconv", "--no-color", "--find-renames", "--format="]

/** NUL-delimited numstat preserves tabs/newlines and both paths of a rename. */
function fileLineStats(output: string) {
  const stats = new Map<string, { additions: number; deletions: number }>()
  const entries = output.split("\0")
  for (let index = 0; index < entries.length; index++) {
    const match = entries[index].match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/)
    if (!match) continue
    let path = match[3]
    if (!path) { index += 2; path = entries[index] }
    if (!path || match[1] === "-" || match[2] === "-") continue
    const additions = Number(match[1]), deletions = Number(match[2])
    if (additions || deletions) stats.set(path, { additions, deletions })
  }
  return stats
}

/** 执行 Git 命令：优先使用 dugite，无法启动时回退；命令非零退出码不重试 */
export async function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { exec } = await import("dugite")
    const res = await exec(args, cwd, { env: { ...process.env, ...gitAuthenticationEnvironment(), LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } })
    // A nonzero Git exit may already have changed the index/worktree (e.g. a
    // conflicted stash apply). Only inability to launch Git permits fallback.
    return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode }
  } catch {
    // 降级回退到系统 git
  }

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, ...gitAuthenticationEnvironment(), LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" }
    })
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => {
      stdout += d.toString()
    })
    child.stderr.on("data", (d) => {
      stderr += d.toString()
    })
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
    child.on("error", (err) => {
      reject(err)
    })
  })
}

export class GitService {
  private readonly pushOperations = new Map<string, { cwd: string; controller: AbortController; completed: boolean }>()

  async cancelPush(cwd: string, operationId: string): Promise<boolean> {
    const operation = this.pushOperations.get(operationId)
    if (!operation || operation.cwd !== cwd || operation.completed) return false
    operation.controller.abort()
    return true
  }
  private stashRestoreHistory = new StashRestoreHistory()
  configureStashRestoreHistory(path: string) { this.stashRestoreHistory = new StashRestoreHistory(path) }

  async getStashRestoreHistory(cwd: string): Promise<GitStashRestoreRecord[]> {
    const directory = await runGit(["rev-parse", "--absolute-git-dir"], cwd)
    if (directory.exitCode !== 0) throw new Error(directory.stderr || "无法读取仓库")
    return this.stashRestoreHistory.list(directory.stdout.trim())
  }

  private readonly restoringStashes = new Set<string>()
  /** Checks whether repo. */
  async isRepo(cwd: string): Promise<boolean> {
    if (!cwd || !existsSync(cwd)) return false
    try {
      const res = await runGit(["rev-parse", "--is-inside-work-tree"], cwd)
      return res.exitCode === 0 && res.stdout.trim() === "true"
    } catch {
      return false
    }
  }

  /** Initializes init. */
  async init(cwd: string): Promise<void> {
    const res = await runGit(["init"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Git init failed")
  }

  /** Returns status. */
  async getStatus(cwd: string): Promise<GitStatusResult> {
    const isRepo = await this.isRepo(cwd)
    if (!isRepo) {
      return {
        isRepo: false,
        branch: "",
        upstream: "",
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: []
      }
    }

    const res = await runGit(["status", "--porcelain=v1", "-z", "-b", "-uall"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Git status failed")
    const lines = res.stdout.split("\0")

    let branch = "HEAD"
    let upstream = ""
    let ahead = 0
    let behind = 0

    const staged: GitFileStatus[] = []
    const unstaged: GitFileStatus[] = []
    const untracked: GitFileStatus[] = []
    const conflicts: GitFileStatus[] = []

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      if (!line) continue
      if (line.startsWith("## ")) {
        // 分支信息，例如 ## main...origin/main [ahead 1, behind 2]
        const branchLine = line.slice(3).trim()
        const match = branchLine.match(/^([^\s.]+)(?:\.\.\.([^\s]+))?(?:\s+\[(?:ahead\s+(\d+))?(?:,\s*)?(?:behind\s+(\d+))?\])?/)
        if (match) {
          branch = match[1] || "HEAD"
          upstream = match[2] || ""
          ahead = match[3] ? parseInt(match[3], 10) : 0
          behind = match[4] ? parseInt(match[4], 10) : 0
        } else {
          branch = branchLine
        }
        continue
      }

      const x = line[0] // 暂存区状态
      const y = line[1] // 工作区状态
      // -z returns raw UTF-8 paths without quoting, with destination before source for renames.
      const filePath = line.slice(3)
      let oldPath: string | undefined
      if (x === "R" || x === "C" || y === "R" || y === "C") {
        oldPath = lines[++index]
      }

      // 未合并 / 冲突状态
      if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
        conflicts.push({ path: filePath, status: "U" })
        continue
      }

      // 未跟踪
      if (x === "?" && y === "?") {
        untracked.push({ path: filePath, status: "?" })
        continue
      }

      // 暂存区
      if (x !== " " && x !== "?") {
        staged.push({ path: filePath, status: x as any, oldPath })
      }

      // 工作区修改
      if (y !== " " && y !== "?") {
        unstaged.push({ path: filePath, status: y as any })
      }
    }

    // Compare the index to HEAD and the worktree to the index independently.
    const diffOptions = ["--numstat", "-z", "--no-ext-diff", "--no-textconv", "--find-renames"]
    await Promise.all([
      ...([ [staged, ["diff", "--cached", ...diffOptions]], [unstaged, ["diff", ...diffOptions]] ] as const).map(async ([files, args]) => {
        if (!files.length) return
        const result = await runGit([...args], cwd)
        if (result.exitCode !== 0) return
        const stats = fileLineStats(result.stdout)
        for (const file of files) Object.assign(file, stats.get(file.path))
      }),
      // Bound concurrency when a repository contains many new files.
      ...Array.from({ length: Math.min(4, untracked.length) }, (_, worker) => (async () => {
        for (let index = worker; index < untracked.length; index += 4) {
          const file = untracked[index]
          const result = await runGit(["diff", "--no-index", ...diffOptions, "--", "/dev/null", file.path], cwd)
          if (result.exitCode <= 1) Object.assign(file, fileLineStats(result.stdout).get(file.path))
        }
      })())
    ])

    let mergeMessage: string | undefined
    // Resolve the per-worktree Git directory rather than assuming cwd/.git is a folder.
    const gitDir = await runGit(["rev-parse", "--absolute-git-dir"], cwd)
    if (gitDir.exitCode === 0) {
      try {
        const directory = gitDir.stdout.trim()
        const [head, message] = await Promise.all([
          readFile(join(directory, "MERGE_HEAD"), "utf8"),
          readFile(join(directory, "MERGE_MSG"), "utf8")
        ])
        if (head.trim()) mergeMessage = message.split(/\r?\n/).filter(line => !line.startsWith("#")).join("\n").trim() || undefined
      } catch { /* No pending merge; a stale MERGE_MSG alone must not become a draft. */ }
    }

    return {
      isRepo: true,
      ...(mergeMessage ? { mergeMessage } : {}),
      branch,
      upstream,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      conflicts
    }
  }

  /** Returns branches. */
  async getBranches(cwd: string): Promise<{ local: string[]; remote: string[]; current: string }> {
    const res = await runGit(["branch", "-a", "--no-color"], cwd)
    const lines = res.stdout.split("\n")
    const local: string[] = []
    const remote: string[] = []
    let current = ""

    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      const isCurrent = raw.startsWith("* ")
      const name = line.replace(/^\*\s+/, "").trim()

      if (name.includes("->")) continue // 跳过 HEAD 指向例如 remotes/origin/HEAD -> origin/main

      if (name.startsWith("remotes/")) {
        remote.push(name.replace(/^remotes\//, ""))
      } else {
        local.push(name)
        if (isCurrent) current = name
      }
    }

    return { local, remote, current }
  }

  /** rev-list 计数缓存：键为 仓库 + 参数 + 相关引用的 sha 指纹，引用变化后自动失效 */
  private countCache = new Map<string, { fingerprint: string; value: Promise<number> }>()

  /** 读取相关引用的 sha 指纹（远比 rev-list --count 便宜） */
  private async refFingerprint(cwd: string, scope: "head" | "all" | "remotes" | string): Promise<string> {
    const args = scope === "head" ? ["rev-parse", "HEAD"] : scope === "all" ? ["show-ref", "--head", "-s"] : scope === "remotes" ? ["for-each-ref", "--format=%(objectname)", "refs/remotes"] : ["rev-parse", scope]
    try {
      const res = await runGit(args, cwd)
      return `${res.exitCode}:${res.stdout.trim()}`
    } catch {
      return ""
    }
  }

  /** Runs a rev-list count, reusing the cached result while the referenced shas are unchanged. */
  private async cachedCount(cwd: string, args: string[], scope: string): Promise<number> {
    const key = `${cwd}\0${args.join(" ")}`
    const fingerprint = await this.refFingerprint(cwd, scope)
    const cached = this.countCache.get(key)
    if (fingerprint && cached && cached.fingerprint === fingerprint) return cached.value
    const value = runGit(args, cwd).then((result) => {
      if (result.exitCode !== 0) return 0
      return Number.parseInt(result.stdout.trim(), 10) || 0
    })
    if (fingerprint) {
      this.countCache.set(key, { fingerprint, value })
      value.catch(() => { if (this.countCache.get(key)?.value === value) this.countCache.delete(key) })
    }
    return value
  }

  /** Counts commits reachable from HEAD or all branches, matching the history list scope. */
  async getLogCount(cwd: string, allBranches = false): Promise<number> {
    const args = ["rev-list", "--count"]
    if (allBranches) {
      args.push(...HISTORY_REVISIONS)
    } else {
      args.push("HEAD")
    }
    return this.cachedCount(cwd, args, allBranches ? "all" : "head")
  }

  /** Counts commits reachable from remote branches. */
  async getRemoteLogCount(cwd: string, allBranches = false, upstream?: string): Promise<number> {
    const args = ["rev-list", "--count"]
    if (allBranches || !upstream) {
      args.push("--remotes")
    } else {
      args.push(upstream)
    }
    return this.cachedCount(cwd, args, allBranches || !upstream ? "remotes" : upstream)
  }

  /** Returns log. */
  async getLog(cwd: string, maxCount = 100, skip = 0, allBranches = false): Promise<GitCommitItem[]> {
    // 格式: hash|parents|author|email|timestamp|message|refs
    const format = "%H|%P|%an|%ae|%at|%s|%D"
    const args = ["log", "--topo-order"]
    if (allBranches) {
      args.push(...HISTORY_REVISIONS)
    }
    args.push(`-n${Math.max(1, Math.min(500, Math.floor(maxCount)))}`)
    args.push(`--skip=${Math.max(0, Math.floor(skip))}`)
    args.push(`--format=format:${format}`)

    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) return []

    const items: GitCommitItem[] = []
    const lines = res.stdout.split("\n")
    for (const line of lines) {
      if (!line) continue
      const parts = line.split("|")
      if (parts.length < 6) continue

      const hash = parts[0]
      const parents = parts[1] ? parts[1].split(" ") : []
      const author = parts[2]
      const email = parts[3]
      const timestamp = parseInt(parts[4], 10) * 1000
      const message = parts[5]
      const refsRaw = parts[6] || ""
      const refs = refsRaw
        ? refsRaw
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean)
        : []

      items.push({
        hash,
        shortHash: hash.slice(0, 7),
        parents,
        author,
        email,
        timestamp,
        date: new Date(timestamp).toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }),
        message,
        refs
      })
    }
    return items
  }

  /** Returns commit detail. */
  async getCommitDetail(cwd: string, hash: string): Promise<GitCommitDetail> {
    const infoRes = await runGit(["show", "--no-patch", "--format=%H|%P|%an|%ae|%at|%B", hash], cwd)
    const [h, p, author, email, timestamp, ...msgParts] = infoRes.stdout.split("|")
    const message = msgParts.join("|").trim()
    const date = new Date(parseInt(timestamp, 10) * 1000).toLocaleString("zh-CN")

    const [filesRes, statusRes] = await Promise.all([
      runGit(["show", ...COMMIT_DIFF_OPTIONS, "--numstat", "-z", hash], cwd),
      runGit(["show", ...COMMIT_DIFF_OPTIONS, "--name-status", "-z", hash], cwd)
    ])
    if (filesRes.exitCode !== 0 || statusRes.exitCode !== 0) throw new Error(filesRes.stderr || statusRes.stderr || "读取提交变更失败")
    const statuses = new Map<string, string>()
    const statusEntries = statusRes.stdout.split("\0")
    for (let index = 0; index < statusEntries.length;) {
      const status = statusEntries[index++]
      if (!status) continue
      const oldPath = statusEntries[index++]
      const path = /^[RC]/.test(status) ? statusEntries[index++] : oldPath
      if (path) statuses.set(path, status[0])
    }
    const files: { path: string; status: string; additions: number; deletions: number }[] = []

    const entries = filesRes.stdout.split("\0")
    for (let index = 0; index < entries.length; index++) {
      const match = entries[index].match(/^(\d+|-)\t(\d+|-)\t([\s\S]*)$/)
      if (match) {
        // -z leaves UTF-8 paths intact; renames carry old and new paths separately.
        let path = match[3]
        if (!path) {
          index += 2
          path = entries[index]
        }
        if (!path) continue
        files.push({
          path,
          status: statuses.get(path) || "M",
          additions: match[1] === "-" ? 0 : parseInt(match[1], 10),
          deletions: match[2] === "-" ? 0 : parseInt(match[2], 10)
        })
      }
    }

    return {
      hash: h || hash,
      parents: p ? p.split(" ") : [],
      author: author || "",
      email: email || "",
      date,
      message,
      files
    }
  }

  /** Returns diff. */
  async getDiff(cwd: string, filePath: string, staged = false, commitHash?: string): Promise<GitDiffResult> {
    let args: string[]
    if (commitHash) {
      args = ["show", ...COMMIT_DIFF_OPTIONS, commitHash, "--", filePath]
    } else if (staged) {
      args = ["diff", "--cached", "--", filePath]
    } else {
      args = ["diff", "--", filePath]
    }

    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "读取差异失败")
    let diff = res.stdout

    // Combined merge patches have one prefix column per parent and cannot be
    // rendered by the two-way diff viewer. Ask Git for stage 2 (ours) versus
    // the working tree, retaining unresolved conflict markers as real changes.
    if (!staged && !commitHash && /^diff --(?:cc|combined) /m.test(diff)) {
      const conflict = await runGit(["diff", "--ours", "--no-ext-diff", "--no-textconv", "--", filePath], cwd)
      if (conflict.exitCode !== 0) throw new Error(conflict.stderr || "读取冲突差异失败")
      diff = conflict.stdout
    }

    // 如果未暂存且是新增文件，git diff 可能为空，读取工作区文件内容展示
    if (!diff && !staged && !commitHash) {
      try {
        const full = join(cwd, filePath)
        if (existsSync(full)) {
          const { readFileSync } = await import("node:fs")
          const content = readFileSync(full, "utf-8")
          diff =
            `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n` +
            content
              .split("\n")
              .map((l) => `+${l}`)
              .join("\n")
        }
      } catch { /* A deleted/unreadable file has no working-tree diff to display. */ }
    }

    return { diff }
  }

  /** Performs the stage operation. */
  async stage(cwd: string, files: string[]): Promise<void> {
    const res = await runGit(["add", "--", ...files], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stage failed")
  }

  /** Performs the unstage operation. */
  async unstage(cwd: string, files: string[]): Promise<void> {
    const res = await runGit(["reset", "HEAD", "--", ...files], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Unstage failed")
  }

  /** Performs the stage all operation. */
  async stageAll(cwd: string): Promise<void> {
    const res = await runGit(["add", "-A"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stage all failed")
  }

  /** Performs the unstage all operation. */
  async unstageAll(cwd: string): Promise<void> {
    const res = await runGit(["reset", "HEAD"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Unstage all failed")
  }

  /** Performs the discard operation. */
  async discard(cwd: string, files: string[], isUntracked = false): Promise<void> {
    if (isUntracked) {
      const res = await runGit(["clean", "-fd", "--", ...files], cwd)
      if (res.exitCode !== 0) throw new Error(res.stderr || "Discard untracked failed")
    } else {
      const res = await runGit(["checkout", "--", ...files], cwd)
      if (res.exitCode !== 0) throw new Error(res.stderr || "Discard changes failed")
    }
  }

  /** Performs the commit operation. */
  async commit(cwd: string, message: string, amend = false): Promise<void> {
    const args = ["commit", "-m", message]
    if (amend) args.push("--amend")
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Commit failed")
  }

  /** Performs the checkout operation. */
  async checkout(cwd: string, branch: string): Promise<void> {
    const res = await runGit(["checkout", branch], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Checkout ${branch} failed`)
  }

  /** Creates branch. */
  async createBranch(cwd: string, name: string, startPoint?: string, checkout = true): Promise<void> {
    const args = checkout ? ["checkout", "-b", name] : ["branch", name]
    if (startPoint) args.push(startPoint)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Create branch ${name} failed`)
  }

  /** Deletes branch. */
  async deleteBranch(cwd: string, name: string, force = false): Promise<void> {
    const res = await runGit(["branch", force ? "-D" : "-d", name], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Delete branch ${name} failed`)
  }

  /** Fetches fetch. */
  async fetch(cwd: string, remote = "origin", options?: GitFetchOptions): Promise<void> {
    if (!options?.all && (!remote || remote.startsWith("-"))) throw new Error("抓取目标无效")
    const args = ["fetch", options ? (options.prune ? "--prune" : "--no-prune") : "--prune"]
    if (options?.tags) args.push("--tags")
    if (options?.all) args.push("--all")
    else args.push("--", remote)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Fetch failed")
  }

  /** Performs the pull operation. */
  async pull(cwd: string, remote = "origin", branch?: string, options?: GitPullOptions): Promise<{ output: string }> {
    if (!remote || remote.startsWith("-") || branch?.startsWith("-")) throw new Error("拉取目标无效")
    const args = ["pull"]
    if (options) {
      if (options.rebase) args.push("--rebase")
      else args.push("--no-rebase", options.commit ? "--commit" : "--no-commit", options.log ? "--log" : "--no-log", options.noFastForward ? "--no-ff" : "--ff")
    }
    args.push("--", remote)
    if (branch) args.push(branch)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Pull failed")
    return { output: res.stdout || res.stderr }
  }

  /** Pushes push. */
  async push(cwd: string, remote = "origin", branch?: string, force = false): Promise<{ output: string }> {
    const args = ["push", remote]
    if (branch) args.push(branch)
    if (force) args.push("--force")
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Push failed")
    return { output: res.stdout || res.stderr }
  }

  async getPushInfo(cwd: string): Promise<GitPushInfo> {
    const [remotes, refs] = await Promise.all([
      runGit(["remote", "-v"], cwd),
      runGit(["for-each-ref", "--format=%(refname)%00%(HEAD)%00%(upstream:remotename)%00%(upstream:remoteref)", "refs/heads", "refs/remotes"], cwd)
    ])
    if (remotes.exitCode || refs.exitCode) throw new Error(remotes.stderr || refs.stderr || "无法读取推送分支")
    const result: GitPushInfo = { remotes: [], branches: [], remoteBranches: [] }
    for (const line of remotes.stdout.split("\n")) {
      const match = /^(\S+)\s+(.+)\s+\(push\)$/.exec(line.trim())
      if (match && !result.remotes.some((remote) => remote.name === match[1])) result.remotes.push({ name: match[1], url: match[2] })
    }
    for (const line of refs.stdout.trimEnd().split("\n")) {
      const [ref, head, upstreamRemote = "", upstream = ""] = line.split("\0")
      if (ref.startsWith("refs/heads/")) result.branches.push({ name: ref.slice(11), current: head === "*", upstreamRemote, upstreamBranch: upstream.replace(/^refs\/heads\//, "") })
      else if (ref.startsWith("refs/remotes/") && !ref.endsWith("/HEAD")) result.remoteBranches.push(ref.slice(13))
    }
    return result
  }

  async pushSelection(cwd: string, selection: GitPushSelection, operationId: string = randomUUID()): Promise<{ output: string }> {
    if (this.pushOperations.has(operationId)) throw new Error("推送任务已存在")
    const operation = { cwd, controller: new AbortController(), completed: false }
    this.pushOperations.set(operationId, operation)
    try {
      return await this.performPushSelection(cwd, selection, operation.controller.signal, () => { operation.completed = true })
    } catch (error) {
      if (operation.controller.signal.aborted) throw new Error("推送已取消")
      throw error
    } finally { this.pushOperations.delete(operationId) }
  }

  private async performPushSelection(cwd: string, selection: GitPushSelection, signal: AbortSignal, complete: () => void): Promise<{ output: string }> {
    if (!selection || typeof selection.remote !== "string" || !Array.isArray(selection.branches) || typeof selection.tags !== "boolean" || (!selection.branches.length && !selection.tags)) throw new Error("请选择要推送的分支或标签")
    const info = await this.getPushInfo(cwd)
    if (!info.remotes.some((remote) => remote.name === selection.remote)) throw new Error("远程仓库不存在")
    const locals = new Set<string>(), targets = new Set<string>()
    for (const branch of selection.branches) {
      if (!branch || typeof branch.local !== "string" || typeof branch.remote !== "string" || typeof branch.track !== "boolean" || !info.branches.some((item) => item.name === branch.local)) throw new Error("本地分支不存在")
      if (locals.has(branch.local) || targets.has(branch.remote)) throw new Error("推送分支不能重复")
      const valid = await runCancellableGit(["check-ref-format", `refs/heads/${branch.remote}`], cwd, signal)
      if (valid.exitCode !== 0) throw new Error(`远程分支名称无效：${branch.remote}`)
      locals.add(branch.local)
      targets.add(branch.remote)
    }
    const result = await runCancellableGit(["push", "--porcelain", ...(selection.tags ? ["--tags"] : []), "--", selection.remote, ...selection.branches.map((branch) => `refs/heads/${branch.local}:refs/heads/${branch.remote}`)], cwd, signal)
    if (result.exitCode !== 0) throw new Error([result.stdout, result.stderr].filter(Boolean).join("\n") || "推送失败")
    complete()
    for (const branch of selection.branches.filter((branch) => branch.track)) {
      for (const [key, value] of [["remote", selection.remote], ["merge", `refs/heads/${branch.remote}`]]) {
        const config = await runGit(["config", "--local", `branch.${branch.local}.${key}`, value], cwd)
        if (config.exitCode !== 0) throw new Error(`分支已推送，但设置跟踪失败：${config.stderr}`)
      }
    }
    return { output: result.stdout || result.stderr }
  }

  /** Merges merge. */
  async merge(cwd: string, branch: string): Promise<{ success: boolean; output: string }> {
    const res = await runGit(["merge", "--no-edit", branch], cwd)
    return {
      success: res.exitCode === 0,
      output: res.stdout || res.stderr
    }
  }

  /** Returns stashes. */
  async getStashes(cwd: string): Promise<GitStashEntry[]> {
    const res = await runGit(["stash", "list", "--format=%gd%x00%H%x00%gs%x00%cI"], cwd)
    if (res.exitCode !== 0) return []
    const stashes: GitStashEntry[] = []
    for (const line of res.stdout.split("\n")) {
      const [selector, hash, subject, createdAt] = line.split("\0")
      const match = selector.match(/^stash@\{(\d+)\}$/)
      if (match) {
        const index = parseInt(match[1], 10)
        const rest = subject?.trim() || ""
        const colonIdx = rest.indexOf(":")
        const name = colonIdx > -1 ? rest.slice(colonIdx + 1).trim() : rest
        stashes.push({
          index,
          hash,
          name: name || rest,
          date: createdAt || ""
        })
      }
    }
    const history = await this.getStashRestoreHistory(cwd).catch(() => [])
    return stashes.map(entry => {
      const restored = history.find(record => record.hash === entry.hash)
      return restored ? { ...entry, lastRestore: { at: restored.at, outcome: restored.outcome, branch: restored.branch } } : entry
    })
  }

  /** Read the saved trees, never the current worktree or merge commit display. */
  async getStashDetail(cwd: string, reference: number | string): Promise<GitStashDetail> {
    const valid = typeof reference === "number" ? Number.isSafeInteger(reference) && reference >= 0 : /^[a-f\d]{40,64}$/i.test(reference)
    if (!valid) throw new Error("贮藏标识无效")
    const ref = typeof reference === "number" ? `stash@{${reference}}` : reference
    const resolved = await runGit(["rev-parse", "--verify", `${ref}^{commit}`], cwd)
    if (resolved.exitCode !== 0) throw new Error(resolved.stderr || "贮藏记录不存在")
    const hash = resolved.stdout.trim()
    const files = new Map<string, GitStashFile>()
    for (const source of ["worktree", "index"] as const) {
      const target = source === "index" ? `${hash}^2` : hash
      const result = await runGit(["diff", "--name-status", "-z", "--find-renames", `${hash}^1`, target], cwd)
      if (result.exitCode !== 0) throw new Error(result.stderr || "无法读取贮藏文件")
      const entries = result.stdout.split("\0")
      for (let index = 0; index < entries.length;) {
        const code = entries[index++]
        if (!code) continue
        const original = entries[index++]
        const renamed = /^[RC]/.test(code)
        const path = renamed ? entries[index++] : original
        if (path && !files.has(path)) files.set(path, { path, status: code[0] as GitFileStatus["status"], ...(renamed ? { oldPath: original } : {}), source })
      }
    }
    const untrackedRef = await runGit(["rev-parse", "--verify", "--quiet", `${hash}^3`], cwd)
    if (untrackedRef.exitCode === 0) {
      const result = await runGit(["ls-tree", "-r", "--name-only", "-z", `${hash}^3`], cwd)
      if (result.exitCode !== 0) throw new Error(result.stderr || "无法读取贮藏的未跟踪文件")
      for (const path of result.stdout.split("\0").filter(Boolean)) if (!files.has(path)) files.set(path, { path, status: "?", source: "untracked" })
    }
    return { hash, files: [...files.values()] }
  }

  async getStashDiff(cwd: string, hash: string, filePath: string): Promise<GitDiffResult> {
    const detail = await this.getStashDetail(cwd, hash)
    const file = detail.files.find((file) => file.path === filePath)
    if (!file) throw new Error("文件不在此贮藏中")
    const options = ["-c", "core.quotepath=false"]
    const args = file.source === "untracked"
      ? [...options, "show", "--format=", "--no-ext-diff", "--no-textconv", "--no-color", `${detail.hash}^3`, "--", file.path]
      : [...options, "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--find-renames", `${detail.hash}^1`, file.source === "index" ? `${detail.hash}^2` : detail.hash, "--", ...(file.oldPath ? [file.oldPath] : []), file.path]
    const result = await runGit(args, cwd)
    if (result.exitCode !== 0) throw new Error(result.stderr || "无法读取贮藏差异")
    return { diff: result.stdout }
  }

  /** Performs the stash save operation. */
  async stashSave(cwd: string, message?: string, files?: string[], options?: { keepIndex?: boolean }): Promise<void> {
    // GitLens-style pathspecs: repo-relative with "./" so untracked/pathspec matching is reliable.
    const pathspecs = (files || [])
      .map((file) => file.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, ""))
      .filter(Boolean)
      .map((file) => (file.startsWith("./") ? file : `./${file}`))
    const args = ["stash", "push"]
    // Include untracked whenever pathspecs are used (or for full-workspace stash).
    args.push("--include-untracked")
    if (options?.keepIndex) args.push("--keep-index")
    if (message) args.push("-m", message)
    if (pathspecs.length > 0) {
      args.push("--", ...pathspecs)
    }
    const res = await runGit(args, cwd)
    const combined = `${res.stdout || ""}\n${res.stderr || ""}`
    if (/No local changes to save/i.test(combined)) {
      throw new Error("没有可贮藏的修改（所选路径可能没有变更）")
    }
    if (res.exitCode !== 0) throw new Error(res.stderr || res.stdout || "Stash save failed")
  }

  /** Performs the stash pop operation. */
  async stashPop(cwd: string, index = 0, expectedHash?: string): Promise<GitStashPopResult> {
    return this.restoreStash(cwd, index, false, expectedHash)
  }

  async stashApply(cwd: string, index = 0, expectedHash?: string): Promise<GitStashPopResult> {
    return this.restoreStash(cwd, index, true, expectedHash)
  }

  private async restoreStash(cwd: string, index: number, keep: boolean, expectedHash?: string): Promise<GitStashPopResult> {
    if (!Number.isSafeInteger(index) || index < 0) throw new Error("贮藏编号无效")
    const directory = await runGit(["rev-parse", "--absolute-git-dir"], cwd)
    if (directory.exitCode !== 0) throw new Error(directory.stderr || "无法读取仓库")
    const key = directory.stdout.trim()
    if (this.restoringStashes.has(key)) throw new Error("正在恢复贮藏，请等待完成后再操作")
    this.restoringStashes.add(key)
    let applied: { entry: GitStashEntry; branch: string; conflicts: string[] } | undefined
    const record = async (dropped: boolean, note?: string): Promise<string | undefined> => {
      if (!applied) return undefined
      try {
        await this.stashRestoreHistory.append(key, {
          id: randomUUID(), hash: applied.entry.hash!, name: applied.entry.name, index: applied.entry.index,
          stashDate: applied.entry.date, at: new Date().toISOString(), branch: applied.branch,
          action: keep ? "apply" : "pop", outcome: applied.conflicts.length ? "conflicts" : "applied",
          conflicts: applied.conflicts, dropped, ...(note ? { note } : {})
        })
      } catch (error) { return `内容已应用，但保存恢复记录失败：${String(error)}` }
      return undefined
    }
    try {
      const result = await this.applyStash(cwd, index, keep, expectedHash, metadata => { applied = metadata })
      const historyWarning = await record(result.dropped)
      return historyWarning ? { ...result, historyWarning } : result
    } catch (error) {
      await record(false, error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      this.restoringStashes.delete(key)
    }
  }

  private async applyStash(cwd: string, index: number, keep: boolean, expectedHash: string | undefined, onApplied: (metadata: { entry: GitStashEntry; branch: string; conflicts: string[] }) => void): Promise<GitStashPopResult> {
    const before = await this.getStatus(cwd)
    if (before.conflicts.length) throw new Error("请先解决当前冲突，再弹出其他贮藏")
    const ref = await runGit(["rev-parse", "--verify", `stash@{${index}}`], cwd)
    if (ref.exitCode !== 0) throw new Error(ref.stderr || "该贮藏不存在")
    const hash = ref.stdout.trim()
    if (expectedHash !== undefined && expectedHash !== hash) throw new Error("贮藏列表已变化，请刷新后重新选择；当前文件和贮藏均未修改")
    const savedEntry = (await this.getStashes(cwd)).find(item => item.hash === hash) || { index, hash, name: hash.slice(0, 8), date: "" }
    const detail = await this.getStashDetail(cwd, hash)
    const caseConfig = await runGit(["config", "--bool", "core.ignorecase"], cwd)
    const normalize = (path: string) => caseConfig.stdout.trim() === "true" ? path.toLowerCase() : path
    const touched = detail.files.flatMap((file) => [file.path, ...(file.oldPath ? [file.oldPath] : [])]).map(normalize)
    const overlaps = (path: string) => touched.some((saved) => saved === path || saved.startsWith(`${path}/`) || path.startsWith(`${saved}/`))
    const dirty = [...new Set([...before.staged, ...before.unstaged, ...before.untracked]
      .flatMap((file) => [file.path, ...(file.oldPath ? [file.oldPath] : [])]).filter((path) => overlaps(normalize(path))))]
    // Ignored files and dangling symlinks are absent from status, but must also
    // stop an untracked restore before Git partially merges other files.
    for (const file of detail.files.filter((file) => file.source === "untracked")) {
      const segments = file.path.split("/")
      for (let index = 1; index <= segments.length; index++) {
        const path = segments.slice(0, index).join("/")
        try {
          const entry = await lstat(join(cwd, path))
          if (index === segments.length || !entry.isDirectory()) { dirty.push(path); break }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") break
          throw error
        }
      }
    }
    if (dirty.length) throw new Error(`以下文件已有本地修改，与贮藏涉及的路径重叠，已停止恢复，未覆盖任何文件。请先提交或另行贮藏当前修改：\n${dirty.join("\n")}`)
    // Apply a stable object ID; remove its reflog entry only after application.
    // Never reuse a previous conflict resolution implicitly for a stash restore.
    const res = await runGit(["-c", "rerere.enabled=false", "-c", "rerere.autoupdate=false", "stash", "apply", hash], cwd)
    const output = `${res.stdout}\n${res.stderr}`.trim()
    const after = await this.getStatus(cwd)
    const conflicts = after.conflicts.map((file) => file.path)
    const conflictOnly = res.exitCode === 1 && conflicts.length > 0 && /^CONFLICT \(/m.test(output)
      && !/^(?:error:|fatal:)|(?:could not|failed to) restore untracked|would be overwritten|index was not unstashed/im.test(output)
    if (res.exitCode !== 0 && !conflictOnly) throw new Error(output || "Stash pop failed")

    onApplied({ entry: savedEntry, branch: before.branch, conflicts })
    // An unresolved merge is not a successful pop. Both versions stay recoverable.
    if (keep || conflicts.length) return { conflicts, dropped: false, output }

    // An external stash push can change ordinal numbers while apply is running.
    const list = await runGit(["stash", "list", "--format=%H%x00%gd"], cwd)
    if (list.exitCode !== 0) throw new Error("贮藏内容已应用，但无法读取贮藏记录；原记录已保留")
    const entry = list.stdout.split("\n").map((line) => line.split("\0")).find(([id]) => id === hash)
    const selector = entry?.[1]
    if (selector && /^stash@\{\d+\}$/.test(selector)) {
      const current = await runGit(["rev-parse", "--verify", selector], cwd)
      if (current.exitCode !== 0 || current.stdout.trim() !== hash) throw new Error("贮藏列表已变化，内容已应用，记录暂未删除")
      const dropped = await runGit(["stash", "drop", selector], cwd)
      if (dropped.exitCode !== 0) throw new Error(`贮藏内容已应用，但删除记录失败：${dropped.stderr || dropped.stdout}`)
    }
    return { conflicts, dropped: true, output }
  }

  /** Performs the stash drop operation. */
  async stashDrop(cwd: string, index = 0): Promise<void> {
    const res = await runGit(["stash", "drop", `stash@{${index}}`], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stash drop failed")
  }

  /** Resets reset. */
  async reset(cwd: string, target: string, mode: "soft" | "mixed" | "hard" = "mixed"): Promise<void> {
    const res = await runGit(["reset", `--${mode}`, target], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Reset failed")
  }

  /** Performs the revert operation. */
  async revert(cwd: string, hash: string): Promise<void> {
    const res = await runGit(["revert", "--no-edit", hash], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Revert failed")
  }

  /** Creates tag. */
  async createTag(cwd: string, tag: string, target = "HEAD", options?: GitTagOptions): Promise<void> {
    if (!tag || tag.startsWith("-") || !target || target.startsWith("-")) throw new Error("标签名称或目标提交无效")
    const valid = await runGit(["check-ref-format", `refs/tags/${tag}`], cwd)
    if (valid.exitCode !== 0) throw new Error("标签名称格式无效")
    const commit = await runGit(["rev-parse", "--verify", `${target}^{commit}`], cwd)
    if (commit.exitCode !== 0) throw new Error("指定的提交不存在")
    if (options?.lightweight && options.sign) throw new Error("轻量标签不支持签名")
    const args = ["tag"]
    if (options?.force) args.push("--force")
    if (options && !options.lightweight) {
      args.push(options.sign ? "--sign" : "--annotate", "--message", options.message?.trim() || tag)
      if (!options.sign) args.push("--no-sign")
    }
    else args.push("--no-sign")
    args.push("--", tag, commit.stdout.trim())
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Create tag failed")
  }

  async getTags(cwd: string): Promise<string[]> {
    const result = await runGit(["tag", "--list", "--sort=-creatordate"], cwd)
    if (result.exitCode !== 0) throw new Error(result.stderr || "读取标签失败")
    return result.stdout.trim().split("\n").filter(Boolean)
  }

  async deleteTag(cwd: string, tag: string): Promise<void> {
    if (!tag || tag.startsWith("-")) throw new Error("标签名称无效")
    const result = await runGit(["tag", "--delete", "--", tag], cwd)
    if (result.exitCode !== 0) throw new Error(result.stderr || "删除标签失败")
  }

  async pushTag(cwd: string, remote: string, tag: string): Promise<void> {
    if (!remote || remote.startsWith("-") || !tag || tag.startsWith("-")) throw new Error("远程仓库或标签无效")
    const remotes = await runGit(["remote"], cwd)
    if (remotes.exitCode !== 0 || !remotes.stdout.split("\n").includes(remote)) throw new Error("远程仓库不存在")
    const result = await runGit(["push", remote, `refs/tags/${tag}:refs/tags/${tag}`], cwd)
    if (result.exitCode !== 0) throw new Error(result.stderr || "推送标签失败")
  }

  async deleteRemoteTag(cwd: string, remote: string, tag: string): Promise<void> {
    if (!remote || remote.startsWith("-") || !tag || tag.startsWith("-")) throw new Error("远程仓库或标签无效")
    const remotes = await runGit(["remote"], cwd)
    if (remotes.exitCode !== 0 || !remotes.stdout.split("\n").includes(remote)) throw new Error("远程仓库不存在")
    const result = await runGit(["push", remote, "--delete", `refs/tags/${tag}`], cwd)
    if (result.exitCode !== 0 && !/remote ref does not exist/i.test(result.stderr)) throw new Error(result.stderr || "删除远程标签失败")
  }

  /** Returns the remote repository URL, prioritizing origin. */
  async getRemoteUrl(cwd: string, remote = "origin"): Promise<string> {
    if (!cwd) return ""
    let res = await runGit(["remote", "get-url", remote], cwd)
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim()
    }
    res = await runGit(["config", "--get", `remote.${remote}.url`], cwd)
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim()
    }
    const listRes = await runGit(["remote"], cwd)
    if (listRes.exitCode === 0) {
      const remotes = listRes.stdout
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
      for (const r of remotes) {
        if (r === remote) continue
        const fallbackRes = await runGit(["remote", "get-url", r], cwd)
        if (fallbackRes.exitCode === 0 && fallbackRes.stdout.trim()) {
          return fallbackRes.stdout.trim()
        }
      }
    }
    return ""
  }

  /** Returns the browser URL of the remote repository. */
  async getRemoteWebUrl(cwd: string): Promise<string> {
    return formatGitRemoteWebUrl(await this.getRemoteUrl(cwd))
  }

  /** Returns the web URL for viewing a commit in the remote repository. */
  async getRemoteCommitUrl(cwd: string, hash: string, remote = "origin"): Promise<string> {
    const remoteUrl = await this.getRemoteUrl(cwd, remote)
    if (!remoteUrl) return ""
    return formatGitCommitWebUrl(remoteUrl, hash)
  }

  /** Returns unpushed commits reachable from the current branch, excluding other local branches. */
  async getUnpushedCommits(cwd: string): Promise<string[]> {
    const res = await runGit(["rev-list", "HEAD", "--not", "--remotes"], cwd)
    if (res.exitCode !== 0) return []
    return res.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

/** Formats a Git remote repository URL into a web URL for viewing a commit. */
export function formatGitRemoteWebUrl(rawRemoteUrl: string): string {
  if (!rawRemoteUrl) return ""
  const s = rawRemoteUrl.trim().replace(/\/+$/, "")

  let base = ""
  if (s.startsWith("http://") || s.startsWith("https://")) {
    const match = s.match(/^(https?:\/\/)(?:[^@]+@)?(.+)$/)
    if (match) {
      base = match[1] + match[2].replace(/\.git$/, "")
    }
  } else if (s.startsWith("ssh://")) {
    const match = s.match(/^ssh:\/\/(?:[^@]+@)?([^:/]+)(?::\d+)?\/(.+)$/)
    if (match) {
      base = `https://${match[1]}/${match[2].replace(/\.git$/, "")}`
    }
  } else if (s.includes("@") && s.includes(":")) {
    const match = s.match(/^(?:[^@]+@)?([^:]+):(.+)$/)
    if (match) {
      const path = match[2].replace(/^\/+/, "").replace(/\.git$/, "")
      base = `https://${match[1]}/${path}`
    }
  }

  return base
}

export function formatGitCommitWebUrl(rawRemoteUrl: string, hash: string): string {
  const base = formatGitRemoteWebUrl(rawRemoteUrl)
  if (!base || !hash) return ""
  const lower = base.toLowerCase()
  if (lower.includes("bitbucket.org")) {
    return `${base}/commits/${hash}`
  }
  if (lower.includes("gitlab")) {
    return `${base}/-/commit/${hash}`
  }
  return `${base}/commit/${hash}`
}

export const gitService = new GitService()
