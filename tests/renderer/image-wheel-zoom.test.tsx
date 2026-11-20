import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Image } from "@/components/ui/image"
import { TransitImageViewer } from "@/components/transit/file-preview/components/transit-image-viewer"
import { ImageFilePreview } from "@/components/image-preview"

vi.mock("@/components/image-preview/editor-sheet", () => ({ ImageEditorSheet: () => null }))
const src = "data:image/png;base64,AAAA"
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  window.electronAPI = { ...window.electronAPI, readImageFile: vi.fn(async () => ({ src, name: "photo.png", path: "/vault/photo.png", mime: "image/png", size: 3, modifiedAt: 0, createdAt: 0 })) }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function wheel(element: HTMLElement, deltaY: number, ctrlKey = true) {
  const event = new WheelEvent("wheel", { deltaY, ctrlKey, bubbles: true, cancelable: true })
  act(() => { element.dispatchEvent(event) })
  return event
}

it("resizes a loaded inline image, preserves normal scrolling, and reports the new width", async () => {
  const resized = vi.fn()
  render(<Image src={src} alt="内嵌图片" width={400} onResizeEnd={resized} />)
  const image = await screen.findByRole("img", { name: "内嵌图片" })
  expect(wheel(image, -100).defaultPrevented).toBe(false)
  fireEvent.load(image)
  expect(wheel(image, -100, false).defaultPrevented).toBe(false)
  expect(resized).not.toHaveBeenCalled()
  expect(wheel(image, -100).defaultPrevented).toBe(true)
  expect(resized).toHaveBeenLastCalledWith(500)
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("500")
  wheel(image, 100)
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("400")
  for (let index = 0; index < 20; index++) wheel(image, -100)
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("1600")
  for (let index = 0; index < 30; index++) wheel(image, 100)
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("80")
})

it.each(["transit", "workspace"])("zooms only the image in the %s preview using its existing scale limits", async (viewer) => {
  render(viewer === "transit" ? <TransitImageViewer src={src} name="photo.png" /> : <ImageFilePreview root="/vault" activeFilePath="/vault/photo.png" />)
  const image = await screen.findByRole("img", { name: "photo.png" })
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } })
  fireEvent.load(image)
  expect(wheel(image, -100, false).defaultPrevented).toBe(false)
  expect(wheel(image, 0).defaultPrevented).toBe(false)
  expect(wheel(image, -100).defaultPrevented).toBe(true)
  if (viewer === "transit") expect(screen.getByText("125%")).toBeTruthy()
  else expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("600")
  wheel(image, 100)
  if (viewer === "transit") expect(screen.getByText("100%（原始尺寸）")).toBeTruthy()
  else expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("480")
  for (let index = 0; index < 25; index++) wheel(image, -100)
  if (viewer === "transit") expect(screen.getByText("800%")).toBeTruthy()
  else expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("1600")
})

it("zooms the lightbox independently and resets its fitted size when reopened", async () => {
  render(<Image src={src} alt="放大预览" width={400} />)
  const image = await screen.findByRole("img", { name: "放大预览" })
  fireEvent.load(image)
  fireEvent.doubleClick(image)
  const enlarged = within(screen.getByRole("dialog")).getByRole("img")
  vi.spyOn(enlarged, "getBoundingClientRect").mockReturnValue({ width: 400 } as DOMRect)
  expect(wheel(enlarged, -100).defaultPrevented).toBe(true)
  expect(enlarged.style.width).toBe("500px")
  expect(enlarged.style.maxWidth).toBe("none")
  expect(screen.getByRole("slider").getAttribute("aria-valuenow")).toBe("400")
  wheel(enlarged, 100)
  expect(enlarged.style.width).toBe("400px")
  fireEvent.click(screen.getByLabelText("关闭图片预览"))
  fireEvent.doubleClick(image)
  expect(within(screen.getByRole("dialog")).getByRole("img").style.width).toBe("")
})
