import React from "react"
import { expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { parseObsidianImageEmbed, resolveObsidianImagePath } from "@vessel/obsidian"
import { prepareObsidianImages, restoreObsidianImages } from "../../src/renderer/src/components/core/canvas/variants/markdown/obsidian-images"
import { Image } from "../../src/renderer/src/components/ui/image"
it("parses spaced attachment names, sizes and resolves nearest candidates", () => {
  expect(parseObsidianImageEmbed("![[Pasted image 20260303174838.png|300x200]]")).toMatchObject({target:"Pasted image 20260303174838.png",width:300,height:200})
  expect(parseObsidianImageEmbed("![[note.md]]")).toBeNull()
  expect(resolveObsidianImagePath("x.png", "notes/doc.md", ["attachments/x.png","notes/x.png"])).toBe("notes/x.png")
  expect(resolveObsidianImagePath("missing.png", "doc.md", ["x.png"])).toBeUndefined()
})
it("keeps source references and code examples unchanged through editor conversion", () => {
  const source = "文字\n![[Pasted image 20260303174838.png]]\n\n```md\n![[example.png]]\n```\n`![[inline.png]]`"
  expect(restoreObsidianImages(prepareObsidianImages(source))).toBe(source)
})
it("shows an error placeholder and supports keyboard image resizing", () => {
  render(<Image src="bad.png" alt="附件" width={300} />)
  fireEvent.error(screen.getByRole("img", {name:"附件"}))
  expect(screen.getByText("图片不存在或无法读取")).toBeTruthy()
  const handle = screen.getByRole("slider")
  fireEvent.keyDown(handle, {key:"ArrowRight"})
  expect(handle.getAttribute("aria-valuenow")).toBe("310")
})
