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
