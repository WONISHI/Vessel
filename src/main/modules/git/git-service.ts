import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

export interface GitFileStatus {
  path: string
  status: "M" | "A" | "D" | "R" | "C" | "U" | "?"
  oldPath?: string
}

export interface GitStatusResult {
  isRepo: boolean
  branch: string
  upstream: string
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  conflicts: GitFileStatus[]
}

export interface GitCommitItem {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  email: string
  timestamp: number
  date: string
  message: string
  refs: string[]
}

export interface GitCommitDetail {
  hash: string
  parents: string[]
  author: string
  email: string
  date: string
  message: string
  files: { path: string; status: string; additions: number; deletions: number }[]
}

export interface GitDiffResult {
  diff: string
  oldContent?: string
  newContent?: string
}

/** 执行 git 命令：优先使用 dugite，若不可用或报错则回退至系统 git */
export async function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { exec } = await import("dugite")
    const res = await exec(args, cwd)
    if (res.exitCode === 0 || (args[0] === "diff" && res.exitCode === 1)) {
      return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode }
    }
  } catch {
    // 降级回退到系统 git
  }

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" }
    })
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
  async isRepo(cwd: string): Promise<boolean> {
    if (!cwd || !existsSync(cwd)) return false
    try {
      const res = await runGit(["rev-parse", "--is-inside-work-tree"], cwd)
      return res.exitCode === 0 && res.stdout.trim() === "true"
    } catch {
      return false
    }
  }

  async init(cwd: string): Promise<void> {
    const res = await runGit(["init"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Git init failed")
  }

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

    const res = await runGit(["status", "--porcelain=v1", "-b", "-uall"], cwd)
    const lines = res.stdout.split("\n")

    let branch = "HEAD"
    let upstream = ""
    let ahead = 0
    let behind = 0

    const staged: GitFileStatus[] = []
    const unstaged: GitFileStatus[] = []
    const untracked: GitFileStatus[] = []
    const conflicts: GitFileStatus[] = []

    for (const line of lines) {
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
      const rest = line.slice(3).trim()
      let filePath = rest
      let oldPath: string | undefined

      if (rest.includes(" -> ")) {
        const parts = rest.split(" -> ")
        oldPath = parts[0]
        filePath = parts[1]
      }

      // 未合并 / 冲突状态
      if (
        (x === "U" || y === "U") ||
        (x === "A" && y === "A") ||
        (x === "D" && y === "D")
      ) {
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

    return {
      isRepo: true,
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

  async getLog(cwd: string, maxCount = 100): Promise<GitCommitItem[]> {
    // 格式: hash|parents|author|email|timestamp|message|refs
    const format = "%H|%P|%an|%ae|%at|%s|%D"
    const res = await runGit(["log", `-n${maxCount}`, `--format=format:${format}`], cwd)
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

  async getCommitDetail(cwd: string, hash: string): Promise<GitCommitDetail> {
    const infoRes = await runGit(["show", "--no-patch", "--format=%H|%P|%an|%ae|%at|%B", hash], cwd)
    const [h, p, author, email, timestamp, ...msgParts] = infoRes.stdout.split("|")
    const message = msgParts.join("|").trim()
    const date = new Date(parseInt(timestamp, 10) * 1000).toLocaleString("zh-CN")

    const filesRes = await runGit(["show", "--numstat", "--format=", hash], cwd)
    const files: { path: string; status: string; additions: number; deletions: number }[] = []

    for (const line of filesRes.stdout.split("\n")) {
      const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/)
      if (match) {
        files.push({
          path: match[3],
          status: "M",
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

  async getDiff(cwd: string, filePath: string, staged = false, commitHash?: string): Promise<GitDiffResult> {
    let args: string[]
    if (commitHash) {
      args = ["show", `${commitHash}`, "--", filePath]
    } else if (staged) {
      args = ["diff", "--cached", "--", filePath]
    } else {
      args = ["diff", "--", filePath]
    }

    const res = await runGit(args, cwd)
    let diff = res.stdout

    // 如果未暂存且是新增文件，git diff 可能为空，读取工作区文件内容展示
    if (!diff && !staged && !commitHash) {
      try {
        const full = join(cwd, filePath)
        if (existsSync(full)) {
          const { readFileSync } = await import("node:fs")
          const content = readFileSync(full, "utf-8")
          diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n` + content.split("\n").map(l => `+${l}`).join("\n")
        }
      } catch {}
    }

    return { diff }
  }

  async stage(cwd: string, files: string[]): Promise<void> {
    const res = await runGit(["add", "--", ...files], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stage failed")
  }

  async unstage(cwd: string, files: string[]): Promise<void> {
    const res = await runGit(["reset", "HEAD", "--", ...files], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Unstage failed")
  }

  async stageAll(cwd: string): Promise<void> {
    const res = await runGit(["add", "-A"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stage all failed")
  }

  async unstageAll(cwd: string): Promise<void> {
    const res = await runGit(["reset", "HEAD"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Unstage all failed")
  }

  async discard(cwd: string, files: string[], isUntracked = false): Promise<void> {
    if (isUntracked) {
      const res = await runGit(["clean", "-fd", "--", ...files], cwd)
      if (res.exitCode !== 0) throw new Error(res.stderr || "Discard untracked failed")
    } else {
      const res = await runGit(["checkout", "--", ...files], cwd)
      if (res.exitCode !== 0) throw new Error(res.stderr || "Discard changes failed")
    }
  }

  async commit(cwd: string, message: string, amend = false): Promise<void> {
    const args = ["commit", "-m", message]
    if (amend) args.push("--amend")
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Commit failed")
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    const res = await runGit(["checkout", branch], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Checkout ${branch} failed`)
  }

  async createBranch(cwd: string, name: string, startPoint?: string, checkout = true): Promise<void> {
    const args = checkout ? ["checkout", "-b", name] : ["branch", name]
    if (startPoint) args.push(startPoint)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Create branch ${name} failed`)
  }

  async deleteBranch(cwd: string, name: string, force = false): Promise<void> {
    const res = await runGit(["branch", force ? "-D" : "-d", name], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || `Delete branch ${name} failed`)
  }

  async fetch(cwd: string, remote = "origin"): Promise<void> {
    const res = await runGit(["fetch", remote, "--prune"], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Fetch failed")
  }

  async pull(cwd: string, remote = "origin", branch?: string): Promise<{ output: string }> {
    const args = ["pull", remote]
    if (branch) args.push(branch)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Pull failed")
    return { output: res.stdout || res.stderr }
  }

  async push(cwd: string, remote = "origin", branch?: string, force = false): Promise<{ output: string }> {
    const args = ["push", remote]
    if (branch) args.push(branch)
    if (force) args.push("--force")
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Push failed")
    return { output: res.stdout || res.stderr }
  }

  async merge(cwd: string, branch: string): Promise<{ success: boolean; output: string }> {
    const res = await runGit(["merge", "--no-edit", branch], cwd)
    return {
      success: res.exitCode === 0,
      output: res.stdout || res.stderr
    }
  }

  async getStashes(cwd: string): Promise<{ index: number; name: string; date: string }[]> {
    const res = await runGit(["stash", "list"], cwd)
    if (res.exitCode !== 0) return []
    const stashes: { index: number; name: string; date: string }[] = []
    for (const line of res.stdout.split("\n")) {
      const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
      if (match) {
        const index = parseInt(match[1], 10)
        const rest = match[2].trim()
        const colonIdx = rest.indexOf(":")
        const dateOrBranch = colonIdx > -1 ? rest.slice(0, colonIdx).trim() : ""
        const name = colonIdx > -1 ? rest.slice(colonIdx + 1).trim() : rest
        stashes.push({
          index,
          name: name || rest,
          date: dateOrBranch
        })
      }
    }
    return stashes
  }

  async stashSave(cwd: string, message?: string, files?: string[]): Promise<void> {
    const args = ["stash", "push", "-u"]
    if (message) args.push("-m", message)
    if (files && files.length > 0) {
      args.push("--", ...files)
    }
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stash save failed")
  }

  async stashPop(cwd: string, index = 0): Promise<void> {
    const res = await runGit(["stash", "pop", `stash@{${index}}`], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stash pop failed")
  }

  async stashDrop(cwd: string, index = 0): Promise<void> {
    const res = await runGit(["stash", "drop", `stash@{${index}}`], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Stash drop failed")
  }

  async reset(cwd: string, target: string, mode: "soft" | "mixed" | "hard" = "mixed"): Promise<void> {
    const res = await runGit(["reset", `--${mode}`, target], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Reset failed")
  }

  async revert(cwd: string, hash: string): Promise<void> {
    const res = await runGit(["revert", "--no-edit", hash], cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Revert failed")
  }

  async createTag(cwd: string, tag: string, target?: string): Promise<void> {
    const args = ["tag", tag]
    if (target) args.push(target)
    const res = await runGit(args, cwd)
    if (res.exitCode !== 0) throw new Error(res.stderr || "Create tag failed")
  }
}

export const gitService = new GitService()
