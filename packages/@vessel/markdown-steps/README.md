# @vessel/markdown-steps

独立的 Markdown 列表解析与 HTML 步骤条／时间线渲染 workspace 包，无 Vessel 或 React 运行时依赖。

```ts
import { parseSteps, renderSteps } from '@vessel/markdown-steps'
import '@vessel/markdown-steps/style.css'

renderSteps('1. 开始\n   - 准备资料\n2. 完成', 'steps')
renderSteps('- 1991 年\n  - Python 发布\n- 现在', 'timeline')
```

在 Vessel 的 Markdown 中使用 `steps` 或 `timeline` 围栏代码块。
一级列表项作为节点；嵌套列表作为节点说明，支持加粗、链接、行内代码。
引用、段落、标题、表格、分割线和代码块等 Markdown 内容可放在节点之后，不缩进时也会归入前一个节点的说明；第一个列表之前的内容归入第一个节点。
至少保留一个列表项作为步骤或时间线节点。
默认采用纵向布局，跟随 `html.dark` 主题。
支持 `font`、`span`、`b`、`strong`、`i`、`em`、`u`、`s`、`del`、`mark`、`small`、`sub`、`sup`、`br` 和安全的 `a` 标签；可使用字体颜色、背景色、字重、斜体、文字装饰及字号样式。
例如：`<font color="#ff4d4f">红色文字</font>`、`<span style="background-color:#fef08a">高亮</span>`。
其他 HTML 被转义，事件属性和非白名单样式会被移除，不安全链接不渲染为可点击链接。
非列表内容抛出错误，宿主负责显示错误和原始源码，不修改源文件。
