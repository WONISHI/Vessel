import {expect,it} from "vitest"
import {parseFrontmatter} from "@vessel/obsidian/frontmatter"
it("parses flat document properties and preserves exact source for round trips",()=>{
 const source='---\r\n项目名称: "[[项目]]"\r\nhttp地址: https://example.com:40081/path\r\n登录地址（测试） :\r\n项目名: "\\rcms"\r\n---\r\n# 正文'
 const parsed=parseFrontmatter(source)!
 expect(parsed.properties).toEqual([{key:"项目名称",value:"[[项目]]"},{key:"http地址",value:"https://example.com:40081/path"},{key:"登录地址（测试）",value:""},{key:"项目名",value:"\rcms"}])
 expect(parsed.raw+parsed.body).toBe(source)
 expect(parsed.body).toBe("# 正文")
})
it("does not interpret ordinary rules, code examples or complex YAML as flat properties",()=>{
 expect(parseFrontmatter("---\n正文\n---")).toBeNull()
 expect(parseFrontmatter("```yaml\n---\n项目: text\n---\n```")).toBeNull()
 expect(parseFrontmatter("---\nitems:\n  - one\n---")).toBeNull()
})
