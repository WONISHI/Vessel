# @vessel/markdown-table

Vessel 的富文本高级表格扩展包。通过解析 ````markdown-table```` 代码块，在 Markdown 编辑器中直接渲染所见即所得的可视化表格，支持单元格合并、背景色与字体颜色自定义、行列增删等，并将修改实时序列化为 JSON 持久化在 Markdown 源码中。

## 功能特性

- **单元格合并与拆分**：支持跨行（`rowspan`）与跨列（`colspan`）自由合并，并支持随时一键拆分还原。
- **自定义色彩与排版**：预设常用单元格背景色、字体颜色、粗体、斜体、居左/居中/居右对齐。
- **直接行内编辑**：双击或选定单元格即可打字输入，支持 Tab 快速在单元格间流转。
- **动态行列增删**：自由插入上方/下方行、左侧/右侧列，删除选定行/列，并在增删时自动更新已有的合并区域索引。
- **JSON 源码模式切换**：提供快速切换至 JSON 源码编辑视图，方便高级用户批量调整结构。
- **双向同步与撤销栈**：所有交互操作无缝衔接 Vditor Undo 历史栈，修改自动触发文档保存。
- **深色模式支持**：完整适配深色主题，背景与文字色彩兼顾清晰度与对比度。

## 语法格式

````markdown
```markdown-table
{
  "caption": "季度业绩表",
  "columns": [
    { "width": 120, "align": "center" },
    { "width": 160, "align": "center" },
    { "width": 160, "align": "center" }
  ],
  "rows": [
    {
      "isHeader": true,
      "cells": [
        { "id": "c_0_0", "text": "类别", "style": { "bgColor": "#f3f4f6", "bold": true } },
        { "id": "c_0_1", "text": "主要内容", "style": { "bgColor": "#f3f4f6", "bold": true } },
        { "id": "c_0_2", "text": "", "style": { "bgColor": "#f3f4f6" } }
      ]
    },
    {
      "cells": [
        { "id": "c_1_0", "text": "项目 A", "style": {} },
        { "id": "c_1_1", "text": "详细说明", "style": {} },
        { "id": "c_1_2", "text": "正常", "style": { "textColor": "#16a34a" } }
      ]
    }
  ],
  "merges": [
    { "startRow": 0, "startCol": 1, "endRow": 0, "endCol": 2 }
  ]
}
```
````
