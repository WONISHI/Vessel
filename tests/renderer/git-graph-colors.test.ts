import { expect, it } from "vitest"
import type { GitCommitItem } from "@vessel/type"
import { computeGitTopology } from "@/pages/git/components/git-graph"

function commit(hash: string, ...parents: string[]): GitCommitItem {
  return { hash, parents, shortHash: hash, message: hash, author: "Test", email: "test@example.com", timestamp: 0, date: "", refs: [] }
}

it("distinguishes simple paths that share a merge boundary while keeping each path continuous", () => {
  const commits = [
    commit("merge-1", "main-1", "branch-1"),
    commit("branch-1", "branch-1-end"),
    commit("branch-1-end", "merge-2"),
    commit("main-1", "main-1-end"),
    commit("main-1-end", "merge-2"),
    commit("merge-2", "main-2", "branch-2"),
    commit("branch-2", "branch-2-end"),
    commit("branch-2-end", "base"),
    commit("main-2", "base"),
    commit("base")
  ]
  const { nodes, maxColumns } = computeGitTopology(commits)
  const first = nodes[1].color, second = nodes[6].color, main = nodes[0].color
  expect(nodes.map((node) => node.column)).toEqual([0, 1, 1, 0, 0, 0, 1, 1, 0, 0])
  expect(maxColumns).toBe(2)
  expect(first).not.toBe(second)
  expect(second).toBe("#dc2626")
  expect(main).toBe("#2563eb")
  expect(first).not.toBe(main)
  expect(second).not.toBe(main)
  expect(nodes[2].color).toBe(first)
  expect(nodes[7].color).toBe(second)
  for (const index of [3, 4, 5, 8, 9]) expect(nodes[index].color).toBe(main)
  expect(nodes[0].lines.find((line) => line.type === "branch")?.color).toBe(first)
  expect(nodes[4].lines.find((line) => line.type === "merge")?.color).toBe(first)
  expect(nodes[5].lines.find((line) => line.type === "branch")?.color).toBe(second)
  expect(nodes[8].lines.find((line) => line.type === "merge")?.color).toBe(second)

  // Loading older commits must not recolor the paths already on screen.
  const partial = computeGitTopology(commits.slice(0, 7)).nodes
  expect(partial.map((node) => node.color)).toEqual(nodes.slice(0, 7).map((node) => node.color))
})

it("keeps an already active branch color when another merge connects to it", () => {
  const { nodes } = computeGitTopology([
    commit("merge", "main", "branch"),
    commit("main", "base", "branch"),
    commit("branch", "base"),
    commit("base")
  ])
  const color = nodes[2].color
  expect(nodes[0].lines.find((line) => line.type === "branch")?.color).toBe(color)
  expect(nodes[1].lines.find((line) => line.type === "branch")?.color).toBe(color)
  expect(color).not.toBe(nodes[0].color)
})

it("reserves colors at touching merge boundaries without changing the main path", () => {
  const commits: GitCommitItem[] = []
  for (let index = 0; index < 15; index++) {
    const base = index === 14 ? "base" : `merge-${index + 1}`
    commits.push(commit(`merge-${index}`, `main-${index}`, `branch-${index}`), commit(`branch-${index}`, base), commit(`main-${index}`, base))
  }
  commits.push(commit("base"))
  const { nodes } = computeGitTopology(commits)
  const main = nodes[0].color
  const colors = nodes.filter((node) => node.commit.hash.startsWith("branch-")).map((node) => node.color)
  expect(new Set(colors)).toEqual(new Set(["#dc2626", "#f59e0b"]))
  for (let index = 0; index < colors.length; index++) {
    expect(colors[index]).not.toBe(main)
    if (index) expect(colors[index]).not.toBe(colors[index - 1])
  }
  expect(nodes.filter((node) => node.column === 0).every((node) => node.color === main)).toBe(true)
})

it("uses distinct fixed colors for concurrent tracks and their connecting lines", () => {
  const { nodes } = computeGitTopology([
    commit("merge", "main", "branch-a", "branch-b"),
    commit("branch-b", "base"),
    commit("branch-a", "base"),
    commit("main", "base"),
    commit("base")
  ])
  expect(nodes.map((node) => node.column)).toEqual([0, 2, 1, 0, 0])
  expect(new Set(nodes.slice(0, 3).map((node) => node.color)).size).toBe(3)
  for (const node of nodes.slice(1, 3)) {
    expect(nodes[0].lines.find((line) => line.toCol === node.column)?.color).toBe(node.color)
    expect(node.lines.filter((line) => line.fromCol === node.column).every((line) => line.color === node.color)).toBe(true)
  }
})

it("separates the shared tail of nested merges from a later independent merge section", () => {
  // Reduced from the screenshot's actual DAG: d106c54f and 7fdbd421 are nested merges,
  // and both paths reach 8712a544. The later 03338f1c merge starts a separate section.
  const commits = [
    commit("6d713b30", "ed41b5bf", "c3ba07a5"),
    commit("c3ba07a5", "d106c54f"),
    commit("d106c54f", "ce26c408", "7fdbd421"),
    commit("ce26c408", "c9e2c82f"),
    commit("c9e2c82f", "8712a544"),
    commit("ed41b5bf", "7fdbd421"),
    commit("7fdbd421", "8dd844ff", "8712a544"),
    commit("8712a544", "08e67d2b"),
    commit("08e67d2b", "3535cb83"),
    commit("8dd844ff", "3535cb83"),
    commit("3535cb83", "0395e23a"),
    commit("0395e23a", "03338f1c"),
    commit("03338f1c", "db6d702d", "cd530821"),
    commit("cd530821", "948d661c"),
    commit("948d661c", "base"),
    commit("db6d702d", "base"),
    commit("base")
  ]
  const { nodes } = computeGitTopology(commits)
  const byHash = new Map(nodes.map((node) => [node.commit.hash, node]))
  const upper = byHash.get("8712a544")!, lower = byHash.get("cd530821")!
  expect(upper.column).toBe(lower.column)
  expect(upper.color).toBe("#eab308")
  expect(lower.color).toBe("#dc2626")
  expect(byHash.get("08e67d2b")!.color).toBe(upper.color)
  expect(byHash.get("948d661c")!.color).toBe(lower.color)
  expect(byHash.get("ce26c408")!.color).toBe(byHash.get("c9e2c82f")!.color)
  const merge = byHash.get("7fdbd421")!
  expect(merge.lines.find((line) => line.type === "branch")?.color).toBe(upper.color)
  const partial = computeGitTopology(commits.slice(0, 9)).nodes
  expect(partial.map((node) => node.color)).toEqual(nodes.slice(0, 9).map((node) => node.color))
})

it("matches all screenshot sections together: simple merges red and the nested documentation path orange", () => {
  const edges = [
    ["a4389874", "8f71ed46"], ["8f71ed46", "fe696b34"], ["fe696b34", "40123c42"],
    ["40123c42", "b44f1306", "a6ae6380"], ["a6ae6380", "84b8f43a"], ["b44f1306", "84b8f43a"],
    ["84b8f43a", "3f056692"], ["3f056692", "5495ae8f"], ["5495ae8f", "2d49eef0"],
    ["2d49eef0", "ae5adb12", "6b1bad92"], ["6b1bad92", "d51f676c"], ["d51f676c", "6d713b30"],
    ["ae5adb12", "261f849c"], ["261f849c", "5e08f57e"], ["5e08f57e", "23a5efbc"], ["23a5efbc", "6d713b30"],
    ["6d713b30", "ed41b5bf", "c3ba07a5"], ["c3ba07a5", "bf59ae46"], ["bf59ae46", "95563360"],
    ["95563360", "d106c54f"], ["d106c54f", "ce26c408", "7fdbd421"], ["ce26c408", "c9e2c82f"],
    ["c9e2c82f", "8712a544"], ["ed41b5bf", "7fdbd421"], ["7fdbd421", "8dd844ff", "8712a544"],
    ["8712a544", "08e67d2b"], ["08e67d2b", "3535cb83"], ["8dd844ff", "3535cb83"], ["3535cb83"]
  ]
  const commits = edges.map(([hash, ...parents]) => commit(hash, ...parents))
  const { nodes } = computeGitTopology(commits)
  const byHash = new Map(nodes.map((node) => [node.commit.hash, node]))
  const red = byHash.get("6b1bad92")!, orange = byHash.get("c3ba07a5")!
  expect(red.column).toBe(orange.column)
  expect(red.color).toBe("#dc2626")
  expect(orange.color).toBe("#f59e0b")
  expect(byHash.get("a6ae6380")!.color).toBe(red.color)
  expect(byHash.get("d51f676c")!.color).toBe(red.color)
  for (const hash of ["bf59ae46", "95563360", "d106c54f", "ce26c408", "c9e2c82f"]) {
    expect(byHash.get(hash)!.color).toBe(orange.color)
  }
  expect(byHash.get("2d49eef0")!.lines.find((line) => line.type === "branch")?.color).toBe(red.color)
  expect(byHash.get("6d713b30")!.lines.find((line) => line.type === "branch")?.color).toBe(orange.color)
})

it("keeps a boundary path orange while the path ending at that merge is still red", () => {
  const edges = [
    ["eea2c295", "cfcec7a2"],
    ["cfcec7a2", "6f8d9997", "a07cae12"],
    ["a07cae12", "80627205"], ["80627205", "67014571"], ["67014571", "cd5beec0"],
    ["6f8d9997", "cd5beec0"],
    ["cd5beec0", "8ff6d547", "9ca6e25b"],
    ["9ca6e25b", "a0928767"], ["8ff6d547", "a0928767"], ["a0928767"]
  ]
  const { nodes } = computeGitTopology(edges.map(([hash, ...parents]) => commit(hash, ...parents)))
  const byHash = new Map(nodes.map((node) => [node.commit.hash, node]))
  for (const hash of ["a07cae12", "80627205", "67014571"]) {
    expect(byHash.get(hash)!.color).toBe("#f59e0b")
  }
  expect(byHash.get("9ca6e25b")!.color).toBe("#dc2626")
  expect(byHash.get("cfcec7a2")!.lines.find((line) => line.type === "branch")?.color).toBe("#f59e0b")
  expect(byHash.get("6f8d9997")!.lines.find((line) => line.type === "merge")?.color).toBe("#f59e0b")
})

it("corrects only the nested shared-tail boundary from the SourceTree screenshot", () => {
  // Actual parent order around 5488c882. The shared tail 10b4b38f ends at
  // merge 8a1b82b1, which also starts the next independent side path.
  const edges = [
    ["a816e6df", "8e61b437", "10a6cfab"],
    ["10a6cfab", "cf3ad5fe", "49901805"],
    ["cf3ad5fe", "10b4b38f"],
    ["8e61b437", "49901805"],
    ["49901805", "5488c882", "10b4b38f"],
    ["10b4b38f", "8a1b82b1"],
    ["5488c882", "84fefc4d"],
    ["84fefc4d", "c42843df"],
    ["c42843df", "8a1b82b1"],
    ["8a1b82b1", "4201ebd1", "965592a8"],
    ["965592a8", "34f5fa54"],
    ["4201ebd1", "d16dc3c2"],
    ["d16dc3c2", "2887293a"],
    ["2887293a", "f026fa2f"],
    ["f026fa2f", "c42965ec"],
    ["c42965ec", "34f5fa54"],
    ["34f5fa54", "gap"],
    ["gap", "older-merge"],
    ["older-merge", "older-main", "older-side"],
    ["older-side", "base"], ["older-main", "base"], ["base"]
  ]
  const commits = edges.map(([hash, ...parents]) => commit(hash, ...parents))
  const { nodes } = computeGitTopology(commits)
  const byHash = new Map(nodes.map((node) => [node.commit.hash, node]))
  const red = "#dc2626", orange = "#f59e0b", blue = "#2563eb"
  expect(byHash.get("10b4b38f")!.color).toBe(red)
  expect(byHash.get("c42843df")!.lines.find((line) => line.type === "merge")?.color).toBe(red)
  expect(byHash.get("49901805")!.lines.find((line) => line.type === "branch")?.color).toBe(red)
  expect(byHash.get("8a1b82b1")!.lines.find((line) => line.type === "branch")?.color).toBe(orange)
  expect(byHash.get("965592a8")!.color).toBe(orange)
  expect(byHash.get("c42965ec")!.lines.find((line) => line.type === "merge")?.color).toBe(orange)
  // Keep the already accepted colors before and after the marked section.
  for (const hash of ["10a6cfab", "cf3ad5fe"]) expect(byHash.get(hash)!.color).toBe(orange)
  expect(byHash.get("10a6cfab")!.lines.find((line) => line.type === "branch")?.color).toBe(red)
  expect(byHash.get("older-side")!.color).toBe(red)
  for (const hash of ["5488c882", "84fefc4d", "c42843df", "8a1b82b1", "4201ebd1", "d16dc3c2", "2887293a", "f026fa2f", "c42965ec"]) {
    expect(byHash.get(hash)!.column).toBe(0)
    expect(byHash.get(hash)!.color).toBe(blue)
  }
})
