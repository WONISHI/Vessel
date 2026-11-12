import { describe, expect, it } from "vitest"
import { convertCase } from "@/pages/debug/case-convert/convert"

describe("convertCase", () => {
  it.each(["hello world", "helloWorld", "HelloWorld", "hello-world", "hello_world"])("converts %s into identifier styles", (input) => {
    expect(convertCase(input).map((result) => result.value).slice(1)).toEqual(["helloWorld", "HelloWorld", "hello-world", "HELLO_WORLD"])
  })
  it("recognizes acronym boundaries and preserves digits", () => {
    expect(convertCase("HTTPServer_v2").map((result) => result.value)).toEqual(["httpserver_v2", "httpServerV2", "HttpServerV2", "http-server-v2", "HTTP_SERVER_V2"])
  })
  it("handles empty input and separators", () => {
    expect(convertCase("").every((result) => result.value === "")).toBe(true)
    expect(convertCase(" --_ ").slice(1).every((result) => result.value === "")).toBe(true)
  })
  it("preserves Unicode letters", () => {
    expect(convertCase("你好 world")[3].value).toBe("你好-world")
  })
})
