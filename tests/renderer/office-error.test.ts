import { describe, expect, it } from "vitest"
import { formatOfficeError } from "@/features/office/components/office-components-shared"

describe("formatOfficeError", () => {
  it("extracts the clean error message from nested Electron IPC errors", () => {
    const raw = "Error: Error: Error invoking remote method 'office:convert-markdown': Error: MarkItDown 运行环境未安装，请配置 VESSEL_MARKITDOWN_PYTHON (Python 3.10+ 并安装 markitdown)。"
    expect(formatOfficeError(raw)).toBe("MarkItDown 运行环境未安装，请配置 VESSEL_MARKITDOWN_PYTHON (Python 3.10+ 并安装 markitdown)。")
  })

  it("handles standard Error instances", () => {
    const err = new Error("Error invoking remote method 'office:convert-markdown': Error: 转换超时")
    expect(formatOfficeError(err)).toBe("转换超时")
  })

  it("handles simple error strings", () => {
    expect(formatOfficeError("普通错误信息")).toBe("普通错误信息")
    expect(formatOfficeError("Error: 操作失败")).toBe("操作失败")
  })

  it("provides a fallback for empty or falsy errors", () => {
    expect(formatOfficeError("")).toBe("操作失败，请重试")
    expect(formatOfficeError(null)).toBe("操作失败，请重试")
    expect(formatOfficeError(undefined)).toBe("操作失败，请重试")
  })
})
