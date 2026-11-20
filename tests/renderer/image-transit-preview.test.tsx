import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { Image } from "@/components/ui/image"
import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
import { addTransitFile } from "@/components/transit/state"
import { setActivityBarCollapsed } from "@/features/activity-bar/collapse"

vi.mock("@/components/transit/state", () => ({ addTransitFile: vi.fn() }))
vi.mock("@/components/image-preview/editor-sheet", () => ({ ImageEditorSheet: () => null }))
afterEach(() => { cleanup(); setActivityBarCollapsed(false); vi.clearAllMocks() })

it("adds the resolved local attachment to transit from its image context menu", async () => {
  const resolveObsidianImage = vi.fn(async () => "/images/photo.png")
  window.electronAPI = { ...window.electronAPI, resolveObsidianImage, readObsidianImage: vi.fn(async () => "data:image/png;base64,AAAA") }
  render(<ObsidianImage reference="![[photo.png]]" root="/vault" documentPath="/vault/note.md" onChange={vi.fn()} />)
  const image = await screen.findByRole("img")
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  fireEvent.click(await screen.findByRole("menuitem", { name: "添加到中转站" }))
  await waitFor(() => expect(addTransitFile).toHaveBeenCalledWith("/images", "/images/photo.png", "photo.png"))
  expect(resolveObsidianImage).toHaveBeenCalledWith("/vault", "/vault/note.md", "![[photo.png]]")
})

it("imports inline image bytes into transit without changing the Markdown document", async () => {
  const importTransitImage = vi.fn(async () => ({ root: "/cache", path: "/cache/image.png", title: "图片" }))
  window.electronAPI = { ...window.electronAPI, importTransitImage }
  render(<Image src="data:image/png;base64,AAAA" alt="图片" />)
  const image = await screen.findByRole("img", { name: "图片" })
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  fireEvent.click(await screen.findByRole("menuitem", { name: "添加到中转站" }))
  await waitFor(() => expect(importTransitImage).toHaveBeenCalledWith("data:image/png;base64,AAAA", "图片"))
  expect(addTransitFile).toHaveBeenCalledWith("/cache", "/cache/image.png", "图片")
})

it("leaves activity buttons accessible and clickable while an image is enlarged", async () => {
  const navigate = vi.fn()
  render(<><nav aria-label="工作台活动栏"><button onClick={navigate}>浏览器活动</button></nav><Image src="data:image/png;base64,AAAA" alt="预览" /></>)
  const image = await screen.findByRole("img", { name: "预览" })
  fireEvent.load(image)
  fireEvent.doubleClick(image)
  expect(screen.getByRole("dialog")).toBeTruthy()
  expect((document.querySelector("[data-image-preview-overlay]") as HTMLElement).style.left).toBe("52px")
  expect(document.body.style.pointerEvents).not.toBe("none")
  fireEvent.click(screen.getByRole("button", { name: "浏览器活动" }))
  expect(navigate).toHaveBeenCalledOnce()
})
