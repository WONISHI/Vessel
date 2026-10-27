import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile, rename } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { GitService, formatGitRemoteWebUrl, formatGitCommitWebUrl } from "@main/modules/git/git-service"

it("counts all commits and pages past the original 150-record limit without duplicates", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-history-"))
  try {
    execFileSync("git", ["init", "-b", "master", root])
    let input = ""
    for (let index = 1; index <= 163; index++) {
      const message = `commit ${index}`
      input += `commit refs/heads/master\nmark :${index}\ncommitter Test <test@example.com> ${1700000000 + index} +0000\ndata ${Buffer.byteLength(message)}\n${message}\n${index > 1 ? `from :${index - 1}\n` : ""}\n`
    }
    execFileSync("git", ["fast-import", "--quiet"], { cwd: root, input })
    const service = new GitService()
    expect(await service.getLogCount(root)).toBe(163)
    const first = await service.getLog(root, 150)
    const second = await service.getLog(root, 150, 150)
    expect(first).toHaveLength(150)
    expect(second).toHaveLength(13)
    expect(new Set([...first, ...second].map((item) => item.hash)).size).toBe(163)
    expect(second.at(-1)?.message).toBe("commit 1")
    expect(await service.getLog(root, 150, 163)).toEqual([])

    // 创建另外一个未合并的分支 feature
    execFileSync("git", ["branch", "feature", "master~5"], { cwd: root })
    const featureInput = "commit refs/heads/feature\nmark :200\ncommitter Test <test@example.com> 1700000300 +0000\ndata 14\nfeature commit\nfrom refs/heads/feature^0\n\n"
    execFileSync("git", ["fast-import", "--quiet"], { cwd: root, input: featureInput })

    // HEAD 仅统计 master，而 allBranches=true 包含 feature
    expect(await service.getLogCount(root, false)).toBe(163)
    expect(await service.getLogCount(root, true)).toBe(164)

    const allLogs = await service.getLog(root, 200, 0, true)
    expect(allLogs.some((c) => c.message === "feature commit")).toBe(true)

    const headLogs = await service.getLog(root, 200, 0, false)
    expect(headLogs.some((c) => c.message === "feature commit")).toBe(false)

    // 此时无远程分支，getRemoteLogCount 应返回 0
    expect(await service.getRemoteLogCount(root, true)).toBe(0)

    // 创建模拟远程分支 refs/remotes/origin/master
    execFileSync("git", ["update-ref", "refs/remotes/origin/master", "refs/heads/master~3"], { cwd: root })
    expect(await service.getRemoteLogCount(root, true)).toBe(160)
    // Other local branches must not inflate the current branch's pending push badge.
    expect(await service.getUnpushedCommits(root)).toHaveLength(3)
    execFileSync("git", ["update-ref", "refs/remotes/origin/master", "refs/heads/master"], { cwd: root })
    expect(await service.getUnpushedCommits(root)).toEqual([])
    execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/feature"], { cwd: root })
    const featureHash = execFileSync("git", ["rev-parse", "feature"], { cwd: root, encoding: "utf8" }).trim()
    expect(await service.getUnpushedCommits(root)).toEqual([featureHash])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it("converts remote transport URLs to repository web URLs without changing commit links", () => {
  expect(formatGitRemoteWebUrl("git@github.com:owner/repo.git")).toBe("https://github.com/owner/repo")
  expect(formatGitRemoteWebUrl("https://user:secret@gitlab.com/group/repo.git")).toBe("https://gitlab.com/group/repo")
  expect(formatGitRemoteWebUrl("ssh://git@example.com:2222/team/repo.git")).toBe("https://example.com/team/repo")
  expect(formatGitRemoteWebUrl("/local/repo")).toBe("")
  expect(formatGitCommitWebUrl("git@gitlab.com:group/repo.git", "abc")).toBe("https://gitlab.com/group/repo/-/commit/abc")
})

it("preserves Chinese, quotes and whitespace in commit file paths, including renames", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-git-paths-"))
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" })
  try {
    git("init", "-b", "master")
    const original = '面试题 \"测试\"\t记录.md'
    await writeFile(join(root, original), "hello\n")
    git("add", ".")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "add")
    const service = new GitService()
    expect((await service.getCommitDetail(root, "HEAD")).files[0]).toMatchObject({ path: original, additions: 1, status: "A" })
    const target = "重命名后的笔记.md"
    await rename(join(root, original), join(root, target))
    git("add", "-A")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "rename")
    expect((await service.getCommitDetail(root, "HEAD")).files[0]).toMatchObject({ path: target, status: "R" })
    await writeFile(join(root, target), "hello\nupdated\n")
    git("add", "-A")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "modify")
    expect((await service.getCommitDetail(root, "HEAD")).files[0].status).toBe("M")
    git("rm", "--", target)
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "delete")
    expect((await service.getCommitDetail(root, "HEAD")).files[0]).toMatchObject({ path: target, status: "D" })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
