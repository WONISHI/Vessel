import { describe, expect, it } from "vitest"
import {
  adjustMergesOnDeleteCol,
  adjustMergesOnDeleteRow,
  adjustMergesOnInsertCol,
  adjustMergesOnInsertRow,
  getCellMergeInfo,
  mergeSelection,
  parseMarkdownTable,
  serializeMarkdownTable,
  splitMergeAt
} from "../src/index.js"

describe("markdown-table parser and serializer", () => {
  it("generates a default table when given empty string", () => {
    const table = parseMarkdownTable("")
    expect(table.rows.length).toBeGreaterThan(0)
    expect(table.columns.length).toBeGreaterThan(0)
    expect(table.caption).toBe("高级表格")
  })

  it("handles malformed JSON gracefully", () => {
    const table = parseMarkdownTable("{ broken json")
    expect(table.rows.length).toBeGreaterThan(0)
  })

  it("round trips table data through serializer and parser", () => {
    const initial = parseMarkdownTable("")
    initial.caption = "测试表格"
    initial.rows[0].cells[0].text = "Header 1"
    initial.rows[0].cells[0].style = { bgColor: "#ff0000", bold: true }

    const serialized = serializeMarkdownTable(initial)
    const parsed = parseMarkdownTable(serialized)

    expect(parsed.caption).toBe("测试表格")
    expect(parsed.rows[0].cells[0].text).toBe("Header 1")
    expect(parsed.rows[0].cells[0].style?.bgColor).toBe("#ff0000")
    expect(parsed.rows[0].cells[0].style?.bold).toBe(true)
  })
})

describe("merge utils", () => {
  it("calculates merge info correctly for master and covered cells", () => {
    const merges = [{ startRow: 0, startCol: 1, endRow: 1, endCol: 2 }]

    const master = getCellMergeInfo(merges, 0, 1)
    expect(master.isMaster).toBe(true)
    expect(master.isCovered).toBe(false)
    expect(master.rowSpan).toBe(2)
    expect(master.colSpan).toBe(2)

    const covered = getCellMergeInfo(merges, 1, 2)
    expect(covered.isMaster).toBe(false)
    expect(covered.isCovered).toBe(true)

    const normal = getCellMergeInfo(merges, 0, 0)
    expect(normal.isMaster).toBe(false)
    expect(normal.isCovered).toBe(false)
  })

  it("merges selection and removes overlapping merges", () => {
    const initialMerges = [{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }]
    const nextMerges = mergeSelection(initialMerges, 0, 0, 1, 2)

    expect(nextMerges).toHaveLength(1)
    expect(nextMerges[0]).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 2 })
  })

  it("splits a merge at target coordinate", () => {
    const merges = [{ startRow: 0, startCol: 0, endRow: 1, endCol: 1 }]
    const remaining = splitMergeAt(merges, 1, 1)
    expect(remaining).toHaveLength(0)
  })

  it("adjusts merges when inserting rows and columns", () => {
    const merges = [{ startRow: 1, startCol: 1, endRow: 2, endCol: 2 }]
    const afterInsertRow = adjustMergesOnInsertRow(merges, 0)
    expect(afterInsertRow[0]).toEqual({ startRow: 2, startCol: 1, endRow: 3, endCol: 2 })

    const afterInsertCol = adjustMergesOnInsertCol(afterInsertRow, 0)
    expect(afterInsertCol[0]).toEqual({ startRow: 2, startCol: 2, endRow: 3, endCol: 3 })
  })

  it("adjusts merges when deleting rows and columns", () => {
    const merges = [{ startRow: 2, startCol: 2, endRow: 3, endCol: 3 }]
    const afterDeleteRow = adjustMergesOnDeleteRow(merges, 0)
    expect(afterDeleteRow[0]).toEqual({ startRow: 1, startCol: 2, endRow: 2, endCol: 3 })

    const afterDeleteCol = adjustMergesOnDeleteCol(afterDeleteRow, 0)
    expect(afterDeleteCol[0]).toEqual({ startRow: 1, startCol: 1, endRow: 2, endCol: 2 })
  })
})
