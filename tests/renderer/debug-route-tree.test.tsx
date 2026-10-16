// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useDevToolsRouteTree } from "@/pages/debug/components/hooks/useDevToolsRouteTree"
const state = vi.hoisted(() => ({ matched: [] as unknown[] }))
vi.mock("@vessel/react-router", () => ({ useRoute: () => state }))
it("builds navigation from the independent debug parent and selects its active child", () => {
  const consolePage = { name: "devtools-console", path: "console", meta: { title: "控制台", group: "主要功能", order: 1 } }
  const storagePage = { name: "devtools-storage", path: "storage", meta: { title: "数据存储", group: "工具", order: 2 } }
  const root = { name: "debug", path: "/debug", children: [{ index: true }, consolePage, storagePage] }
  state.matched = [
    { name: "debug", record: root },
    { name: "devtools-storage", record: storagePage }
  ]
  const { result } = renderHook(useDevToolsRouteTree)
  expect(result.current?.root).toBe(root)
  expect(result.current?.groups.map((group) => group.children?.map((child) => child.name))).toEqual([["devtools-console"], ["devtools-storage"]])
  expect(result.current?.currentPage).toBe(storagePage)
})
