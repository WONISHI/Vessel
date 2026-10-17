import { expect, it } from "vitest"
import { headingSections } from "@/components/core/canvas/variants/markdown/heading-sections"

it("keeps quoted headings aligned with outline indices and retains the final chapter images", () => {
  const source = `# 开始
正文

> [!question] 为什么
> ### 1. 为什么 JS 使用 chunkhash？
>
> - 原因一
>
>### 2. 为什么 CSS 使用 contenthash？
>
> - 原因二

# 第三十九章 功能模块设计和目录结构

**功能模块设计**

![[Pasted image 20260812215203.png]]

**目录结构设计**

![[Pasted image 20260812215426.png]]`
  const sections = headingSections(source)
  expect(sections).toHaveLength(4)
  expect(sections[1]).toContain("为什么 JS")
  expect(sections[2]).toContain("为什么 CSS")
  expect(sections[3]).toContain("**功能模块设计**")
  expect(sections[3]).toContain("![[Pasted image 20260812215426.png]]")
})
