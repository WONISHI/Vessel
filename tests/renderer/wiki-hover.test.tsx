import React from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { WikiLinkPreview } from "../../src/renderer/src/components/core/canvas/variants/markdown/wiki-link-preview"
vi.mock("../../src/renderer/src/components/core/canvas/variants/markdown/section-preview", () => ({ PreviewBody: ({ source }: { source: string }) => <div>{source}</div> }))
afterEach(() => { cleanup(); vi.useRealTimers() })
it("reads only after 1.5 seconds and cancels early mouse leave", async () => {
  vi.useFakeTimers()
  const read = vi.fn().mockResolvedValue({ content: "preview body", path: "/vault/a.md" })
  window.electronAPI = { readWikiLink: read } as unknown as Window["electronAPI"]
  const host = document.createElement("div")
  host.innerHTML = '<span data-wiki-target="a">[[a]]</span>'
  document.body.append(host)
  render(<WikiLinkPreview host={{ current: host }} workspacePath="/vault" />)
  const link = host.firstElementChild!
  fireEvent.mouseOver(link)
  act(() => vi.advanceTimersByTime(1499))
  expect(read).not.toHaveBeenCalled()
  fireEvent.mouseOut(link, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(100))
  expect(read).not.toHaveBeenCalled()
  fireEvent.mouseOver(link)
  await act(async () => { vi.advanceTimersByTime(1500) })
  expect(read).toHaveBeenCalledWith("/vault", "a")
  expect(document.body.textContent).toContain("preview body")
  fireEvent.mouseOut(link, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(100))
  fireEvent.mouseOver(link)
  await act(async () => { vi.advanceTimersByTime(1600) })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.mouseOut(link, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(100))
  const card = document.querySelector("[data-wiki-preview]")!
  fireEvent.mouseOver(card, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(10000))
  expect(document.body.textContent).toContain("preview body")
  fireEvent.mouseOut(card, { relatedTarget: document.body })
  act(() => vi.advanceTimersByTime(350))
  expect(document.body.textContent).not.toContain("preview body")
  host.remove()
})
