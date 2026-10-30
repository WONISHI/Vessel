// @vitest-environment jsdom
import React from "react"
import { expect, it, vi, afterEach } from "vitest"
import { fireEvent, render, screen, cleanup } from "@testing-library/react"
import { parseObsidianImageEmbed, resolveObsidianImagePath, parseImageReference, resizeImageReference } from "@vessel/obsidian"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { Image } from "@/components/ui/image"
import { ObsidianImageLine } from "@/components/core/canvas/variants/markdown/obsidian-images"
it("parses spaced attachment names, sizes and resolves nearest candidates", () => {
  expect(parseObsidianImageEmbed("![[Pasted image 20260303174838.png|300x200]]")).toMatchObject({ target: "Pasted image 20260303174838.png", width: 300, height: 200 })
  expect(parseObsidianImageEmbed("![[note.md]]")).toBeNull()
  expect(resolveObsidianImagePath("x.png", "notes/doc.md", ["attachments/x.png", "notes/x.png"])).toBe("notes/x.png")
  expect(resolveObsidianImagePath("missing.png", "doc.md", ["x.png"])).toBeUndefined()
})
it("keeps source references and code examples unchanged through editor conversion", () => {
  const source = "文字\n![[Pasted image 20260303174838.png]]\n\n```md\n![[example.png]]\n```\n`![[inline.png]]`"
  expect(restoreObsidianImages(prepareObsidianImages(source))).toBe(source)
})
it("shows an error placeholder and supports keyboard image resizing", async () => {
  render(
    <Image
      src="bad.png"
      alt="附件"
      width={300}
    />
  )
  fireEvent.error(await screen.findByRole("img", { name: "附件" }))
  expect(screen.getByRole("img", { name: "图片不存在或无法读取" })).toBeTruthy()
  const handle = screen.getByRole("slider")
  fireEvent.keyDown(handle, { key: "ArrowRight" })
  expect(handle.getAttribute("aria-valuenow")).toBe("310")
})

it("reads Markdown widths and writes resized widths without changing the path", () => {
  const source = "![image|925](软考/assets/image.png)"
  expect(parseImageReference(source)).toMatchObject({ target: "软考/assets/image.png", width: 925, alt: "image" })
  expect(resizeImageReference(source, 640)).toBe("![image|640](软考/assets/image.png)")
  expect(resizeImageReference("![[Pasted image.png]]", 320)).toBe("![[Pasted image.png|320]]")
  expect(restoreObsidianImages(prepareObsidianImages(source))).toBe(source)
})
it("opens a larger image dialog on double click", async () => {
  render(
    <Image
      src="valid.png"
      alt="放大测试"
    />
  )
  const image = await screen.findByRole("img", { name: "放大测试" })
  fireEvent.load(image)
  fireEvent.doubleClick(image)
  expect(screen.getByRole("dialog")).toBeTruthy()
})

it("separates image titles from local paths and preserves titles on resize", () => {
  const source = '![image|925](软考/assets/image.png "两网、一站、十二金")'
  expect(parseImageReference(source)?.target).toBe("软考/assets/image.png")
  expect(resizeImageReference(source, 640)).toBe('![image|640](软考/assets/image.png "两网、一站、十二金")')
})

afterEach(() => {
  cleanup()
})

it("supports viewing and editing image reference link, and deleting image", async () => {
  const onChange = vi.fn()
  window.electronAPI = {
    ...window.electronAPI,
    readObsidianImage: vi.fn().mockResolvedValue("https://example.com/test.png")
  } as any
  render(
    <ObsidianImageLine
      source="![测试](https://example.com/test.png)"
      root="/workspace"
      documentPath="doc.md"
      onChange={onChange}
    />
  )
  const image = await screen.findByRole("img", { name: "测试" })
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  const viewLinkItem = await screen.findByText("查看图片链接")
  expect(viewLinkItem).toBeTruthy()
  fireEvent.click(viewLinkItem)

  const input = screen.getByDisplayValue("https://example.com/test.png")
  expect(input).toBeTruthy()

  fireEvent.change(input, { target: { value: "https://example.com/new.png" } })
  const saveBtn = screen.getByRole("button", { name: "保存" })
  fireEvent.click(saveBtn)
  expect(onChange).toHaveBeenCalledWith("![测试](https://example.com/new.png)")
})

it("supports deleting image via delete button in link bar", async () => {
  const onChange = vi.fn()
  window.electronAPI = {
    ...window.electronAPI,
    readObsidianImage: vi.fn().mockResolvedValue("https://example.com/test.png")
  } as any
  render(
    <ObsidianImageLine
      source="![测试](https://example.com/test.png)"
      root="/workspace"
      documentPath="doc.md"
      onChange={onChange}
    />
  )
  const image = await screen.findByRole("img", { name: "测试" })
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  const viewLinkItem = await screen.findByText("查看图片链接")
  fireEvent.click(viewLinkItem)

  const delBtn = screen.getByRole("button", { name: "删除" })
  fireEvent.click(delBtn)
  expect(onChange).toHaveBeenCalledWith("")
})

it("supports copying and dragging address via 1号图标 (copy button)", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, {
    clipboard: { writeText }
  })
  window.electronAPI = {
    ...window.electronAPI,
    readObsidianImage: vi.fn().mockResolvedValue("https://example.com/test.png")
  } as any
  render(
    <ObsidianImageLine
      source="![测试](https://example.com/test.png)"
      root="/workspace"
      documentPath="doc.md"
      onChange={vi.fn()}
    />
  )
  const image = await screen.findByRole("img", { name: "测试" })
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  const viewLinkItem = await screen.findByText("查看图片链接")
  fireEvent.click(viewLinkItem)

  const copyBtn = screen.getByRole("button", { name: "复制图片地址" })
  expect(copyBtn).toBeTruthy()
  expect(copyBtn.getAttribute("draggable")).toBe("true")

  // 点击复制地址
  fireEvent.click(copyBtn)
  expect(writeText).toHaveBeenCalledWith("https://example.com/test.png")

  // 拖拽复制地址
  const setData = vi.fn()
  const dataTransfer = { setData, effectAllowed: "" }
  fireEvent.dragStart(copyBtn, { dataTransfer })
  expect(setData).toHaveBeenCalledWith("text/plain", "https://example.com/test.png")
  expect(setData).toHaveBeenCalledWith("text/uri-list", "https://example.com/test.png")
})

it("loads relative HTML image references through the workspace resolver and preserves source", () => {
  const reference = '<img src="src/renderer/src/assets/logo.png" width="96" height="96" alt="Vessel Logo" />'
  expect(parseImageReference(reference)).toMatchObject({ target: "src/renderer/src/assets/logo.png", width: 96, height: 96, alt: "Vessel Logo" })
  const source = `<p align="center">\n  ${reference}\n</p>\n\n# Vessel`
  expect(prepareObsidianImages(source)).toContain("```vessel-obsidian-image")
  expect(restoreObsidianImages(prepareObsidianImages(source))).toBe(source)
  expect(resizeImageReference(reference, 128)).toContain('width="128"')
})

it("copies a filename-only Wiki embed instead of image bytes or Markdown data URLs", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  window.electronAPI = { ...window.electronAPI, readObsidianImage: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") } as any
  render(<ObsidianImageLine source="![[attachments/photo.png]]" root="/workspace" documentPath="/workspace/note.md" onChange={vi.fn()} />)
  const image = await screen.findByRole("img")
  fireEvent.load(image)
  fireEvent.contextMenu(image)
  fireEvent.click(await screen.findByRole("menuitem", { name: "复制" }))
  expect(writeText).toHaveBeenCalledWith("![[photo.png]]")
})

it("deletes only the selected occurrence of a Wiki image while retaining surrounding text and other references", async () => {
  window.electronAPI = { ...window.electronAPI, readObsidianImage: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") } as any
  const onChange = vi.fn()
  render(<ObsidianImageLine source="前文 ![[photo.png]] 中间 ![[photo.png]] 后文" root="/workspace" documentPath="/workspace/note.md" onChange={onChange} />)
  const images = await screen.findAllByRole("img")
  fireEvent.load(images[0])
  fireEvent.contextMenu(images[0])
  fireEvent.keyDown(await screen.findByRole("menuitem", { name: "删除" }), { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "引用删除" }))
  expect(onChange).toHaveBeenCalledWith("前文  中间 ![[photo.png]] 后文")
})
