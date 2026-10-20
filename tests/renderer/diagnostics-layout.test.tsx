import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { DiagnosticsContent } from "@/pages/debug/diagnostics/components/diagnostics-content"
import { ConsolePage } from "@/pages/debug/console/components/console-page"

vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@vessel/react-router/components", () => ({ RouterView: () => <div data-testid="route-outlet">路由内容</div> }))
vi.mock("@/pages/debug/components/hooks/useDevToolsRouteTree", () => ({ useDevToolsRouteTree: () => ({
  groups: [{ name: "main", meta: { title: "主要功能" }, children: [{ name: "console", meta: { title: "控制台" } }] }],
  currentGroup: { meta: { title: "主要功能" }, children: [] },
  currentPage: { meta: { title: "控制台" } }
}) }))
afterEach(cleanup)

it("keeps shared breadcrumbs above the child route outlet without a second sidebar", () => {
  const { container } = render(<DiagnosticsContent />)
  const navigation = screen.getByRole("navigation", { name: "调试页面导航" })
  expect(navigation.textContent).toContain("主要功能")
  expect(navigation.querySelector('[aria-current="page"]')?.textContent).toBe("控制台")
  expect(screen.getByTestId("route-outlet").closest("main")?.previousElementSibling).toBe(navigation)
  expect(container.querySelector("aside")).toBeNull()
})

it("updates the error badge when logs are cleared and reports paused monitoring", () => {
  render(<ConsolePage />)
  expect(screen.getByText("1 Error")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "清空" }))
  expect(screen.getByText("0 Error")).toBeTruthy()
  expect(screen.getByText("暂无日志")).toBeTruthy()
  fireEvent.click(screen.getByRole("switch", { name: "总开关" }))
  expect(screen.getByText("已暂停")).toBeTruthy()
})
