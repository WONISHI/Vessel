import { expect, it } from "vitest"
import { localFileURL } from "@vessel/utils"
it("opens local HTML paths without losing reserved characters or Unicode", () => {
  expect(localFileURL("/Users/test/设计 #1?.html")).toBe("file:///Users/test/%E8%AE%BE%E8%AE%A1%20%231%3F.html")
  expect(localFileURL("C:\\work\\a b%20.html")).toBe("file:///C:/work/a%20b%2520.html")
  expect(localFileURL("\\\\server\\share\\a.html")).toBe("file://server/share/a.html")
  expect(() => localFileURL("relative.html")).toThrow()
})
