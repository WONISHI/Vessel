import { expect, it } from "vitest"
import { browserURL } from "../../src/renderer/src/pages/browser/url"
import { outlineHeading } from "../../src/renderer/src/components/core/canvas/variants/markdown/outline-heading"
it("recognizes URLs, localhost ports and Chinese search terms", () => {
  expect(browserURL("github.com/docs")).toBe("https://github.com/docs")
  expect(browserURL("localhost:3000")).toBe("http://localhost:3000/")
  expect(browserURL("https://example.com/a?q=1#b")).toBe("https://example.com/a?q=1#b")
  expect(browserURL("中文 搜索")).toBe("https://www.bing.com/search?q=%E4%B8%AD%E6%96%87%20%E6%90%9C%E7%B4%A2")
  expect(browserURL("file:///tmp/test.md")).toBe("file:///tmp/test.md")
  expect(browserURL("chrome-extension://test/login.html?/muser/login")).toBe("chrome-extension://test/login.html?/muser/login")
  expect(() => browserURL("javascript:alert(1)")).toThrow()
})
it("renders Markdown outline labels as readable text without executing HTML", () => {
  expect(outlineHeading("## **核心区别** 与 `代码<T>`").text).toBe("核心区别 与 代码<T>")
  expect(outlineHeading("1. **功能定位不同** [说明](https://example.com)").text).toBe("1. 功能定位不同 说明")
  expect(outlineHeading('<font color="red">**重要**</font><script>bad()</script>')).toEqual({ text: "重要", color: "red" })
})
