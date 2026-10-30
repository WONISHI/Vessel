import { expect, it } from "vitest"
import { sortWorkspaceNodes } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"

it("sorts files automatically ascending by default", () => {
  const nodes: WorkspaceNode[] = [
    { name: "10.md", path: "/w/10.md", type: "file" },
    { name: "2.md", path: "/w/2.md", type: "file" },
    { name: "1.md", path: "/w/1.md", type: "file" },
    { name: "folderB", path: "/w/folderB", type: "directory" },
    { name: "folderA", path: "/w/folderA", type: "directory" }
  ]

  const sorted = sortWorkspaceNodes(nodes)
  expect(sorted.map((n) => n.name)).toEqual(["folderA", "folderB", "1.md", "2.md", "10.md"])
})

it("sorts files by creation time descending when specified", () => {
  const nodes: WorkspaceNode[] = [
    { name: "old.md", path: "/w/old.md", type: "file", ctime: 1000 },
    { name: "new.md", path: "/w/new.md", type: "file", ctime: 2000 },
    { name: "mid.md", path: "/w/mid.md", type: "file", ctime: 1500 },
    { name: "folderA", path: "/w/folderA", type: "directory", ctime: 100 },
    { name: "folderB", path: "/w/folderB", type: "directory", ctime: 500 }
  ]

  const sorted = sortWorkspaceNodes(nodes, "ctime", "desc")
  // Folders first (newest folder first), then files (newest file first)
  expect(sorted.map((n) => n.name)).toEqual(["folderB", "folderA", "new.md", "mid.md", "old.md"])
})

it("sorts files by creation time ascending", () => {
  const nodes: WorkspaceNode[] = [
    { name: "old.md", path: "/w/old.md", type: "file", ctime: 1000 },
    { name: "new.md", path: "/w/new.md", type: "file", ctime: 2000 },
    { name: "folderA", path: "/w/folderA", type: "directory", ctime: 100 },
    { name: "folderB", path: "/w/folderB", type: "directory", ctime: 500 }
  ]

  const sorted = sortWorkspaceNodes(nodes, "ctime", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["folderA", "folderB", "old.md", "new.md"])
})

it("sorts files by name ascending and descending", () => {
  const nodes: WorkspaceNode[] = [
    { name: "b.md", path: "/w/b.md", type: "file" },
    { name: "a.md", path: "/w/a.md", type: "file" },
    { name: "c.md", path: "/w/c.md", type: "file" },
    { name: "dir2", path: "/w/dir2", type: "directory" },
    { name: "dir1", path: "/w/dir1", type: "directory" }
  ]

  const asc = sortWorkspaceNodes(nodes, "name", "asc")
  expect(asc.map((n) => n.name)).toEqual(["dir1", "dir2", "a.md", "b.md", "c.md"])

  const desc = sortWorkspaceNodes(nodes, "name", "desc")
  expect(desc.map((n) => n.name)).toEqual(["dir2", "dir1", "c.md", "b.md", "a.md"])
})

it("sorts files automatically with Arabic numbers (1, 2, 3... 10...)", () => {
  const nodes: WorkspaceNode[] = [
    { name: "10.md", path: "/w/10.md", type: "file" },
    { name: "1.md", path: "/w/1.md", type: "file" },
    { name: "20.md", path: "/w/20.md", type: "file" },
    { name: "2.md", path: "/w/2.md", type: "file" },
    { name: "3.md", path: "/w/3.md", type: "file" }
  ]

  const sorted = sortWorkspaceNodes(nodes, "auto", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["1.md", "2.md", "3.md", "10.md", "20.md"])
})

it("sorts files automatically with Chinese numbers (一、二、三... 十...)", () => {
  const nodes: WorkspaceNode[] = [
    { name: "第十章.md", path: "/w/第十章.md", type: "file" },
    { name: "第一章.md", path: "/w/第一章.md", type: "file" },
    { name: "第二十一章.md", path: "/w/第二十一章.md", type: "file" },
    { name: "第二章.md", path: "/w/第二章.md", type: "file" },
    { name: "第三章.md", path: "/w/第三章.md", type: "file" }
  ]

  const sorted = sortWorkspaceNodes(nodes, "auto", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["第一章.md", "第二章.md", "第三章.md", "第十章.md", "第二十一章.md"])
})

it("sorts files automatically with uppercase Chinese numbers (壹、贰、叁... 拾...)", () => {
  const nodes: WorkspaceNode[] = [
    { name: "拾、附录.md", path: "/w/拾、附录.md", type: "file" },
    { name: "壹、立项.md", path: "/w/壹、立项.md", type: "file" },
    { name: "叁、设计.md", path: "/w/叁、设计.md", type: "file" },
    { name: "贰、审批.md", path: "/w/贰、审批.md", type: "file" },
    { name: "肆、开发.md", path: "/w/肆、开发.md", type: "file" }
  ]

  const sorted = sortWorkspaceNodes(nodes, "auto", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["壹、立项.md", "贰、审批.md", "叁、设计.md", "肆、开发.md", "拾、附录.md"])
})

it("parses identical opening prefixes and sorts numbers correctly", () => {
  const nodes: WorkspaceNode[] = [
    { name: "Vue-第2讲.md", path: "/w/Vue-第2讲.md", type: "file" },
    { name: "React-第10讲.md", path: "/w/React-第10讲.md", type: "file" },
    { name: "React-第1讲.md", path: "/w/React-第1讲.md", type: "file" },
    { name: "Vue-第1讲.md", path: "/w/Vue-第1讲.md", type: "file" },
    { name: "React-第2讲.md", path: "/w/React-第2讲.md", type: "file" },
    { name: "文件夹B", path: "/w/文件夹B", type: "directory" },
    { name: "文件夹A", path: "/w/文件夹A", type: "directory" }
  ]

  const sorted = sortWorkspaceNodes(nodes, "auto", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["文件夹A", "文件夹B", "React-第1讲.md", "React-第2讲.md", "React-第10讲.md", "Vue-第1讲.md", "Vue-第2讲.md"])

  const desc = sortWorkspaceNodes(nodes, "auto", "desc")
  expect(desc.map((n) => n.name)).toEqual(["文件夹B", "文件夹A", "Vue-第2讲.md", "Vue-第1讲.md", "React-第10讲.md", "React-第2讲.md", "React-第1讲.md"])
})

it("handles mixed numeral formats seamlessly", () => {
  const nodes: WorkspaceNode[] = [
    { name: "第10章 总结", path: "/w/第10章", type: "file" },
    { name: "第一章 介绍", path: "/w/第一章", type: "file" },
    { name: "第2章 基础", path: "/w/第2章", type: "file" },
    { name: "第拾贰章 深入", path: "/w/第拾贰章", type: "file" },
    { name: "第三章 进阶", path: "/w/第三章", type: "file" },
    { name: "第9章 案例", path: "/w/第9章", type: "file" }
  ]

  const sorted = sortWorkspaceNodes(nodes, "auto", "asc")
  expect(sorted.map((n) => n.name)).toEqual(["第一章 介绍", "第2章 基础", "第三章 进阶", "第9章 案例", "第10章 总结", "第拾贰章 深入"])
})

it("reuses sorted snapshots but invalidates for directory contents and sort rules", () => {
  const nodes: WorkspaceNode[] = [{ name: "b.md", path: "/w/b.md", type: "file" }, { name: "a.md", path: "/w/a.md", type: "file" }]
  const sorted = sortWorkspaceNodes(nodes)
  expect(sortWorkspaceNodes(nodes)).toBe(sorted)
  expect(sortWorkspaceNodes(nodes, "auto", "desc").map((node) => node.name)).toEqual(["b.md", "a.md"])
  const changed = [...nodes, { name: "c.md", path: "/w/c.md", type: "file" as const }]
  expect(sortWorkspaceNodes(changed)).not.toBe(sorted)
  expect(sortWorkspaceNodes(changed)).toHaveLength(3)
})
