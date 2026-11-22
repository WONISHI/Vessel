import { expect, it } from "vitest"
import { canOpenInDefaultBrowser } from "../../src/shared/browser-preview"

it.each(["index.html", "page.HTM", "report.pdf", "photo.PNG", "notes.txt", "data.json", "vector.svg", "video.webm", "audio.mp3", "C:\\folder\\index.HTML"])("offers a browser action for %s", (name) => {
  expect(canOpenInDefaultBrowser(name)).toBe(true)
})
it.each(["document.md", "document.markdown", "drawing.excalidraw.md", "table.csv", "document.docx", "sheet.xlsx", "archive.zip", "drawing.canvas", "README", ".html", "page.html.exe"])("hides the browser action for %s", (name) => {
  expect(canOpenInDefaultBrowser(name)).toBe(false)
})
