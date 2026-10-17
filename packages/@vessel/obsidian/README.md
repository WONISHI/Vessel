# @vessel/obsidian

Vessel 的 Obsidian 兼容解析工具，包含 frontmatter、双向链接、图片引用以及 Bases 表格查询。

## Bases

```ts
import { parseBase, createBaseFile, queryBase } from "@vessel/obsidian/bases"

const definition = parseBase(`
filters:
  and:
    - file.inFolder("项目")
    - file.ext == "md"
properties:
  file.name:
    displayName: 项目名称
views:
  - type: table
    name: 项目列表
    order:
      - file.name
      - 状态
    sort:
      - property: file.name
        direction: ASC
`)

const files = [createBaseFile("项目/示例.md", "---\n状态: 进行中\n---\n正文")]
const result = queryBase(definition, files)
// result.columns、result.rows 可交给任意表格组件渲染。
```

解析包不访问文件系统，也不依赖 React。调用方提供工作区相对路径、Markdown 源文和可选 size / ctime / mtime。Vessel 主进程负责扫描实际文件、缓存未变化的属性，再将所选视图结果通过 IPC 交给 shadcn Table；表格每页显示 100 条，可切换视图和刷新。文件及 `.base` 变更会触发重新查询，表格为只读，不修改 Markdown 或配置文件。

支持：YAML 视图配置；全局和视图级 AND / OR / NOT 筛选；属性比较和布尔表达式；中文属性名和方括号访问；列顺序、显示名称、排序、分组、limit；基础算术和公式依赖；`file.inFolder()`、`hasTag()`、`hasLink()`、`hasProperty()`、字符串/列表 `contains()` 等常用函数。`this.file` 指向当前 Base 文件。非 Markdown 附件也参与文件元数据查询。

兼容范围有明确边界：只渲染 table，不渲染 cards / map / kanban；暂不支持日期时长运算、汇总公式、groupOrder、插件函数及完整 Obsidian 表达式函数库。配置和表达式错误会明确报错；单个公式列失败以空值和警告呈现。不可识别的视图不会被伪装成表格。

表达式使用独立语法解析和白名单求值，不使用 eval 或 Function。YAML 限制别名扩展、深度和循环引用。应用扫描跳过隐藏目录和 node_modules，不跟随符号链接；单个文本上限 8 MB，扫描条目上限 50000，读取异常在界面中提示。

格式依据：[Obsidian Bases syntax](https://obsidian.md/help/bases/syntax) 与 [Views](https://obsidian.md/help/bases/views)。
