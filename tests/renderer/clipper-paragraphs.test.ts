import { expect, it } from "vitest"
import { htmlToMarkdown } from "#vessel-clipper/parser"
it("HTML 源码缩进不应变成段落内的硬换行，保留真正的换行和代码", () => {
  const md = htmlToMarkdown(`<p>更多简单实用例子，包括
        <span>vue</span>
        ，react，ant-design……请转至 <a href="https://github.com/chengheai">https://github.com/chengheai</a>，相互交流</p><p>第二段<br>手动换行</p><pre><code>  const x = 1;\n    console.log(x);</code></pre>`, "https://example.com")
  expect(md).toContain("更多简单实用例子，包括 vue ，react，ant-design……请转至 [https://github.com/chengheai](https://github.com/chengheai)，相互交流")
  expect(md).toContain("第二段\n手动换行")
  expect(md).toContain("  const x = 1;\n    console.log(x);")
})
