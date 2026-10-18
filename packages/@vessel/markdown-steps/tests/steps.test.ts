import { expect, it } from "vitest"
import { parseSteps, renderSteps } from "@vessel/markdown-steps"

it("renders ordered steps with nested Markdown and continuation text", () => {
  const html = renderSteps('1. **了解 Python**\n   - 生于 1991 年\n     - 荷兰程序员 Guido van Rossum\n   - 支持 `print()`\n2. [官方文档](https://python.org)')
  expect(parseSteps('- 无序主题\n  - 说明')).toHaveLength(1)
  expect(html.match(/class="vessel-step"/g)).toHaveLength(2)
  expect(html).toContain('<strong>了解 Python</strong>')
  expect(html).toContain('<code>print()</code>')
  expect(html).toContain('Guido van Rossum')
  expect(html.match(/<ul>/g)).toHaveLength(2)
  expect(html).toContain('href="https://python.org"')
})
it("renders timeline dots and handles Windows newlines", () => {
  const html = renderSteps('- 1991 年\r\n  - Python 发布\r\n- 现在', 'timeline')
  expect(html).toContain('vessel-steps--timeline')
  expect(html).toContain('aria-label="时间线"')
  expect(html).toContain('aria-hidden="true"></span>')
})
it("rejects plain text and escapes executable content", () => {
  expect(() => renderSteps('不是列表')).toThrow('请使用')
  expect(() => renderSteps('')).toThrow('请使用')
  const html = renderSteps('- <img src=x onerror=alert(1)>\n  - [危险链接](javascript:alert)\n  - ![图片](https://example.com/x.png)')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('href="javascript:')
  expect(html).toContain('&lt;img')
})
it("renders inline HTML colors and font styles in titles and nested descriptions", () => {
  const source = '- <font color="#ff4d4f">标题</font>\n  - <span style="color:#0ea5e9;background-color:#fff;font-weight:bold">龟叔</span>\n  - <u>下划线</u> <em>斜体</em> <small>小字</small><br>换行'
  for (const mode of ["steps", "timeline"] as const) {
    const html = renderSteps(source, mode)
    expect(html).toContain('<font style="color:#ff4d4f">标题</font>')
    expect(html).toContain('<span style="color:#0ea5e9;background-color:#fff;font-weight:bold">龟叔</span>')
    expect(html).toContain('<u>下划线</u> <em>斜体</em> <small>小字</small><br>换行')
  }
})
it("drops event handlers, layout styles and unsafe HTML links", () => {
  const html = renderSteps('- <span onclick="alert(1)" style="color:red;position:fixed;background-image:url(https://evil);font-weight:bold">内容</span>\n  - <a href="javascript:alert(1)" onmouseover="alert(1)">链接</a>\n  - <font color="red;position:fixed">文字</font>')
  expect(html).toContain('<span style="color:red;font-weight:bold">内容</span>')
  expect(html).toContain('<a>链接</a>')
  expect(html).toContain('<font>文字</font>')
  expect(html).not.toMatch(/onclick|onmouseover|position:|background-image|javascript:/)
})
it("attaches unindented Markdown blocks to the previous node instead of rejecting the diagram", () => {
  const source = '- 生于1991年\n  - 描述\n\n> 龟叔\n\n### 说明标题\n\n包含 **加粗** 和 `代码` 的段落。\n\n| 名称 | 内容 |\n| --- | --- |\n| Python | 1991 |\n\n```js\nconsole.log(1)\n```\n\n- 下一个节点'
  for (const mode of ["steps", "timeline"] as const) {
    const html = renderSteps(source, mode)
    expect(html.match(/class="vessel-step"/g)).toHaveLength(2)
    expect(html).toContain('<blockquote>\n<p>龟叔</p>\n</blockquote>')
    expect(html).toContain('<h3>说明标题</h3>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<table>')
    expect(html).toContain('<code class="language-js">console.log(1)')
    expect(html.indexOf('龟叔')).toBeLessThan(html.indexOf('下一个节点'))
  }
})
it("keeps introductory Markdown in the first node and nested quotes in their own node", () => {
  const html = renderSteps('## 背景\n\n- 第一项\n  > 引用说明\n\n- 第二项\n\n结尾说明')
  expect(html).toContain('<h2>背景</h2>')
  expect(html).toContain('<blockquote>')
  expect(html).toContain('<p>结尾说明</p>')
  expect(html.match(/class="vessel-step"/g)).toHaveLength(2)
})
