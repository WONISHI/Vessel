// @vitest-environment node
import { describe, expect, it } from "vitest"
import { computeGitTopology } from "@/pages/git/components/git-graph"
import type { GitCommitItem } from "@vessel/type"

function createCommit(hash: string, parents: string[], message = ""): GitCommitItem {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    parents,
    author: "test",
    email: "test@example.com",
    timestamp: Date.now(),
    date: "2026-10-20",
    message,
    refs: []
  }
}

describe("computeGitTopology", () => {
  it("keeps main trunk straight on column 0 and merges side branches cleanly to the left", () => {
    // 模拟图谱：
    // M (merge of B and A) -> A is branch, B is main trunk
    // A -> C (commit on branch)
    // C -> Root
    // B -> Root
    // Root
    const commits: GitCommitItem[] = [
      createCommit("M", ["B", "A"], "merge"),
      createCommit("A", ["C"], "branch commit 1"),
      createCommit("C", ["Root"], "branch commit 2"),
      createCommit("B", ["Root"], "main trunk commit"),
      createCommit("Root", [], "root commit")
    ]

    const { nodes, maxColumns } = computeGitTopology(commits)

    expect(maxColumns).toBe(2)

    // M 应该在列 0
    expect(nodes[0].column).toBe(0)
    // 应该包含直行线（连接主分支 B）和分支线（分支到列 1 的 A）
    expect(nodes[0].lines).toContainEqual({ fromCol: 0, toCol: 0, type: "straight", color: "#2563eb" })
    expect(nodes[0].lines).toContainEqual({ fromCol: 0, toCol: 1, type: "branch", color: "#16a34a" })

    // A 应该在列 1
    expect(nodes[1].column).toBe(1)
    // C 应该在列 1，并且在列 1 保持平行（不提前重叠进列 0）
    expect(nodes[2].column).toBe(1)
    expect(nodes[2].lines).toContainEqual({ fromCol: 1, toCol: 1, type: "straight", color: "#16a34a" })
    expect(nodes[2].lines).toContainEqual({ fromCol: 0, toCol: 0, type: "straight", color: "#2563eb" })

    // B 应该在列 0，并在进入 Root 时将列 1 的分支平滑汇入列 0
    expect(nodes[3].column).toBe(0)
    expect(nodes[3].lines).toContainEqual({ fromCol: 0, toCol: 0, type: "straight", color: "#2563eb" })
    expect(nodes[3].lines).toContainEqual({ fromCol: 1, toCol: 0, type: "merge", color: "#16a34a" })

    // Root 应该在列 0
    expect(nodes[4].column).toBe(0)
  })

  it("does not spawn ghost/duplicate lanes when multiple merge commits merge from the same branch", () => {
    // 模拟用户截图中的情景：
    // master 上有多次 Merge branch 'refactor/0.0.1'：
    // M1 (parents: [M2, B1])
    // B1 (parent: B2)
    // M2 (parents: [M3, B2])
    // B2 (parent: B3)
    // M3 (parents: [Root, B3])
    // B3 (parent: Root)
    // Root
    const commits: GitCommitItem[] = [
      createCommit("M1", ["M2", "B1"], "Merge branch 'refactor/0.0.1' (1)"),
      createCommit("B1", ["B2"], "feat: 更新工作流"),
      createCommit("M2", ["M3", "B2"], "Merge branch 'refactor/0.0.1' (2)"),
      createCommit("B2", ["B3"], "feat: 配置cdn"),
      createCommit("M3", ["Root", "B3"], "Merge branch 'refactor/0.0.1' (3)"),
      createCommit("B3", ["Root"], "feat: 新增图标"),
      createCommit("Root", [], "root")
    ]

    const { nodes, maxColumns } = computeGitTopology(commits)

    // 应该只有 2 列（master 在列 0，refactor/0.0.1 在列 1），绝对不应该出现列 2、列 3 的幽灵空分支线！
    expect(maxColumns).toBe(2)

    // 验证所有 B 提交都在列 1
    expect(nodes.find((n) => n.commit.hash === "B1")?.column).toBe(1)
    expect(nodes.find((n) => n.commit.hash === "B2")?.column).toBe(1)
    expect(nodes.find((n) => n.commit.hash === "B3")?.column).toBe(1)

    // 验证所有 M 提交都在列 0
    expect(nodes.find((n) => n.commit.hash === "M1")?.column).toBe(0)
    expect(nodes.find((n) => n.commit.hash === "M2")?.column).toBe(0)
    expect(nodes.find((n) => n.commit.hash === "M3")?.column).toBe(0)

    // 确保没有连线去向列 2 或更高的列
    for (const node of nodes) {
      for (const line of node.lines) {
        expect(line.fromCol).toBeLessThanOrEqual(1)
        expect(line.toCol).toBeLessThanOrEqual(1)
      }
    }
  })
})
