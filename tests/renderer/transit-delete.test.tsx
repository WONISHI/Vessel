import { useEffect } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { TransitButton } from "@/components/transit/button"
import { addTransit, deleteTransit, useTransit } from "@/components/transit/state"

let ids: string[] = []
function State() {
  const { items } = useTransit()
  useEffect(() => { ids = items.map(item => item.id) }, [items])
  return null
}
afterEach(() => { cleanup(); ids.forEach(deleteTransit); ids = [] })

it("keeps the transit popup open when deleting focused rows, including the last item", async () => {
  addTransit("delete-test-one")
  addTransit("delete-test-two")
  render(<><TransitButton /><State /></>)
  fireEvent.click(screen.getByRole("button", { name: "中转站" }))
  for (const title of ["delete-test-two", "delete-test-one"]) {
    const button = await screen.findByRole("button", { name: `删除 ${title}` })
    act(() => button.focus())
    fireEvent.click(button)
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.queryByRole("button", { name: `删除 ${title}` })).toBeNull()
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true)
  }
  expect(screen.getByText("暂无内容，读取剪贴板添加链接或文字")).toBeTruthy()
  expect(screen.getByText("导入文件")).toBeTruthy()
})
