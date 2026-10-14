import { describe, it, expect } from "vitest"
import LZString from "lz-string"
import {
  isExcalidrawFile,
  parseExcalidrawDocument,
  serializeExcalidrawDocument,
  createNewExcalidrawContent
} from "../src/renderer/src/components/core/canvas/variants/excalidraw/parser"

describe("Excalidraw parser and serializer", () => {
  it("identifies excalidraw files by path and content", () => {
    expect(isExcalidrawFile("notes/flow.excalidraw.md")).toBe(true)
    expect(isExcalidrawFile("notes/diagram.excalidraw")).toBe(true)
    expect(isExcalidrawFile("notes/board.canvas")).toBe(true)
    expect(isExcalidrawFile("notes/normal.md")).toBe(false)
    expect(isExcalidrawFile("notes/normal.md", "---\nexcalidraw-plugin: parsed\n---")).toBe(true)
    expect(isExcalidrawFile("notes/normal.md", "# Excalidraw Data\n```json\n{}```")).toBe(true)
  })

  it("parses uncompressed Obsidian Excalidraw markdown", () => {
    const raw = createNewExcalidrawContent("test")
    const parsed = parseExcalidrawDocument(raw)
    expect(parsed.isMarkdown).toBe(true)
    expect(parsed.elements).toEqual([])
    expect(parsed.appState.viewBackgroundColor).toBe("#ffffff")
  })

  it("parses compressed-json Obsidian Excalidraw markdown using LZ-String", () => {
    const testData = {
      type: "excalidraw",
      version: 2,
      elements: [
        { id: "e1", type: "rectangle", x: 10, y: 20, width: 100, height: 50 }
      ],
      appState: { viewBackgroundColor: "#f0f0f0" }
    }
    const compressed = LZString.compressToBase64(JSON.stringify(testData))
    const md = [
      "---",
      "excalidraw-plugin: parsed",
      "tags: [excalidraw]",
      "---",
      "# Excalidraw Data",
      "## Compressed Drawing",
      "```compressed-json",
      compressed,
      "```",
      "%%"
    ].join("\n")

    const parsed = parseExcalidrawDocument(md)
    expect(parsed.isMarkdown).toBe(true)
    expect(parsed.elements.length).toBe(1)
    expect(parsed.elements[0].id).toBe("e1")
    expect(parsed.appState.viewBackgroundColor).toBe("#f0f0f0")
  })

  it("serializes elements back into Obsidian Excalidraw Markdown with text elements preserved", () => {
    const scene = {
      elements: [
        { id: "t1", type: "text", text: "Architecture Diagram", x: 10, y: 10 },
        { id: "r1", type: "rectangle", x: 0, y: 0, width: 200, height: 100 }
      ],
      appState: { viewBackgroundColor: "#ffffff", gridSize: 20 }
    }
    const output = serializeExcalidrawDocument(scene)
    expect(output).toContain("excalidraw-plugin: parsed")
    expect(output).toContain("Architecture Diagram ^t1")
    expect(output).toContain("```compressed-json")
    expect(output).toContain("## Drawing")

    const reparsed = parseExcalidrawDocument(output)
    expect(reparsed.elements.length).toBe(2)
    expect(reparsed.elements[0].text).toBe("Architecture Diagram")
  })

  it("converts obsidian .canvas JSON to excalidraw scene", () => {
    const canvasJson = JSON.stringify({
      nodes: [
        { id: "node1", x: 50, y: 50, width: 150, height: 80, text: "Step 1" },
        { id: "node2", x: 250, y: 50, width: 150, height: 80, text: "Step 2" }
      ],
      edges: [
        { id: "edge1", fromNode: "node1", toNode: "node2" }
      ]
    })
    const parsed = parseExcalidrawDocument(canvasJson)
    expect(parsed.elements.length).toBe(5) // 2 rects + 2 texts + 1 arrow
  })
})
