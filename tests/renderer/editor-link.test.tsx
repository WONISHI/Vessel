import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LinkInteractionArea } from "../../src/renderer/src/components/ui/link"
afterEach(cleanup)
it("recognizes Vditor IR span links and exposes the shared link menu", async () => {
  const openExternal = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { openExternal } })
  render(
    <LinkInteractionArea>
      <span data-type="a">
        <span className="vditor-ir__link">文档</span>
        <span className="vditor-ir__marker--link">https://example.com</span>
      </span>
    </LinkInteractionArea>
  )
  const link = screen.getByText("文档")
  await waitFor(() => expect(link.dataset.vesselLink).toBe("true"))
  fireEvent.contextMenu(link, { clientX: 10, clientY: 10 })
  fireEvent.click(await screen.findByRole("button", { name: "在默认浏览器中打开" }))
  expect(openExternal).toHaveBeenCalledWith("https://example.com")
})

it("recognizes plain URLs in table cells without touching code or source text", async () => {
  const openExternal = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { openExternal } })
  const { container } = render(
    <LinkInteractionArea>
      <table>
        <tbody>
          <tr>
            <td>https://example.com/path</td>
          </tr>
        </tbody>
      </table>
      <code>https://code.example.com</code>
    </LinkInteractionArea>
  )
  const link = await screen.findByRole("link")
  expect(container.querySelector("td")?.textContent).toBe("https://example.com/path")
  expect(container.querySelector("code [data-vessel-href]")).toBeNull()
  fireEvent.click(link)
  expect(openExternal).toHaveBeenCalledWith("https://example.com/path")
})

it("decorates URLs while the editor is focused", async () => {
  const { container } = render(
    <LinkInteractionArea>
      <div
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
      >
        <p>正在编辑</p>
        <table>
          <tbody>
            <tr>
              <td>https://example.com/focused</td>
            </tr>
          </tbody>
        </table>
      </div>
    </LinkInteractionArea>
  )
  const editor = container.querySelector<HTMLElement>("[contenteditable]")!
  editor.focus()
  const cell = container.querySelector("td")!
  cell.textContent = "https://example.com/updated"
  await waitFor(() => expect(cell.querySelector("[data-vessel-link]")?.textContent).toBe("https://example.com/updated"))
})
