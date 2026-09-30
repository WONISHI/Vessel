import React from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { WikiLinkPreview } from "../../src/renderer/src/components/core/canvas/variants/markdown/wiki-link-preview"
vi.mock("../../src/renderer/src/components/core/canvas/variants/markdown/section-preview", () => ({ PreviewBody: ({ source }: { source: string }) => <div>{source}</div> }))
afterEach(() => { cleanup(); vi.useRealTimers() })
it("reads only after three seconds and cancels early mouse leave", async () => {
  vi.useFakeTimers()
  const read = vi.fn().mockResolvedValue({ content: "preview body", path: "/vault/a.md" })
  window.electronAPI = { readWikiLink: read } as unknown as Window["electronAPI"]
  const host = document.createElement("div")
  host.innerHTML = '<span data-wiki-target="a">[[a]]</span>'
  document.body.append(host)
  render(<WikiLinkPreview host={{ current: host }} workspacePath="/vault" />)
  const link = host.firstElementChild!
  fireEvent.mouseOver(link)
  act(() => vi.advanceTimersByTime(2999))
  expect(read).not.toHaveBeenCalled()
  fireEvent.mouseOut(link, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(100))
  expect(read).not.toHaveBeenCalled()
  fireEvent.mouseOver(link)
  await act(async () => { vi.advanceTimersByTime(3000) })
  expect(read).toHaveBeenCalledWith("/vault", "a")
  expect(document.body.textContent).toContain("preview body")
  host.remove()
})
