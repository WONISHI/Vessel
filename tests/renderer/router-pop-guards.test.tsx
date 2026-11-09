import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { Outlet } from "react-router-dom"
import { createRouter, createWebHashHistory } from "#vessel-react-router/index"
import { RouterProvider } from "#vessel-react-router/components"

afterEach(cleanup)

const settle = (ms = 50) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })

it("finishes back navigation and runs after hooks when global guards exist", async () => {
  window.location.hash = "#/editor/file"
  let allowEditor = true
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [{ component: () => <Outlet />, children: [
      { path: "/", component: () => <span>首页</span>, meta: { title: "首页" } },
      { path: "/settings", component: () => <span>设置页</span>, meta: { title: "设置" } },
      { path: "/editor", component: () => <Outlet />, meta: { title: "编辑器" }, children: [{ path: "file", component: () => <span>编辑页</span> }] }
    ] }]
  })
  router.beforeEach((to) => (to.path.startsWith("/editor") && !allowEditor ? "/" : true))
  router.afterEach((to, _from, failure) => { if (!failure && typeof to.meta.title === "string") document.title = to.meta.title })
  render(<RouterProvider router={router} />)
  await settle()
  for (const path of ["/settings", "/editor/file", "/settings"]) {
    await act(async () => { await router.push(path); await new Promise((resolve) => setTimeout(resolve, 50)) })
  }
  expect(document.title).toBe("设置")

  await act(async () => { await router.back(); await new Promise((resolve) => setTimeout(resolve, 300)) })
  expect(screen.getByText("编辑页")).toBeTruthy()
  expect(document.title).toBe("编辑器")

  await act(async () => { await router.push("/settings"); await new Promise((resolve) => setTimeout(resolve, 50)) })
  allowEditor = false
  await act(async () => { await router.back(); await new Promise((resolve) => setTimeout(resolve, 300)) })
  expect(screen.getByText("首页")).toBeTruthy()
  expect(document.title).toBe("首页")
})
