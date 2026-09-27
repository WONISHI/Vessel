import React from "react"
import { expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { parseObsidianImageEmbed, resolveObsidianImagePath, parseImageReference, resizeImageReference } from "@vessel/obsidian"
import { prepareObsidianImages, restoreObsidianImages } from "../../src/renderer/src/components/core/canvas/variants/markdown/image-source"
import { Image } from "../../src/renderer/src/components/ui/image"
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
it("shows an error placeholder and supports keyboard image resizing", () => {
  render(
    <Image
      src="bad.png"
      alt="附件"
      width={300}
    />
  )
  fireEvent.error(screen.getByRole("img", { name: "附件" }))
  expect(screen.getByText("图片不存在或无法读取")).toBeTruthy()
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
it("opens a larger image dialog on double click", () => {
  render(
    <Image
      src="valid.png"
      alt="放大测试"
    />
  )
  fireEvent.doubleClick(screen.getByRole("img", { name: "放大测试" }))
  expect(screen.getByRole("dialog")).toBeTruthy()
})

it("separates image titles from local paths and preserves titles on resize", () => {
 const source = '![image|925](软考/assets/image.png "两网、一站、十二金")'
 expect(parseImageReference(source)?.target).toBe("软考/assets/image.png")
 expect(resizeImageReference(source, 640)).toBe('![image|640](软考/assets/image.png "两网、一站、十二金")')
})
