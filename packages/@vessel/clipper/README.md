# @vessel/clipper

Vessel 网页剪藏浏览器插件（Web Clipper Extension for Chrome & Chromium）。

## 功能特性

1. **多模式智能剪藏**：
   - 📄 **全文文章**：智能提取网页核心正文，自动移除广告、导航、侧边栏等干扰元素，转换为优雅的 Markdown 格式。
   - ✂️ **选中文本**：网页中划词选中内容，一键提取选中文本及对应 DOM 结构的 Markdown。
   - 🔖 **网址书签**：保存当前网址、标题、简介元数据卡片。
2. **丰富的元数据与批注**：
   - 自动生成 YAML Frontmatter（标题、原文链接、剪藏时间、作者、标签等）。
   - 支持自定义标题、目标保存文件夹（默认 `Clippings/`）、标签与个人阅读批注笔记。
   - 提供 Markdown 即时折叠预览。
3. **无缝连接 Vessel 桌面端**：
   - 自动检测本地运行的 Vessel 桌面端（`http://127.0.0.1:35678`）。
   - 点击「保存到 Vessel」一键将剪藏内容写入当前打开的工作区文件树。
   - 桌面端未打开时，自动支持降级保存：「下载 .md 文件」或「复制 Markdown 到剪贴板」。
4. **右键快捷菜单**：
   - 右键页面任意位置：「剪藏整个网页到 Vessel」
   - 右键选中文本：「剪藏选中文本到 Vessel」
   - 右键超链接：「剪藏链接到 Vessel」

## 构建与加载

```bash
# 构建插件
npm run build --workspace=@vessel/clipper
```

在 Chrome、Edge 或 Chromium 浏览器中：
1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `packages/@vessel/clipper/dist` 目录即可载入使用。

## 模板剪藏与编辑

- 支持文章、当前选区和书签三种提取方式。
- 弹窗可选择默认模板、摘录卡片或自定义正文模板；目录、标签和自定义模板保存在浏览器本地，不上传。
- 正文模板支持 `{{title}}`、`{{url}}`、`{{author}}`、`{{site}}`、`{{date}}`、`{{content}}`、`{{notes}}`、`{{tags}}`、`{{description}}`，自动附加 YAML 属性。未知变量保留原样，不执行脚本，也不支持 Obsidian 的过滤器/逻辑语法。
- 展开 Markdown 编辑区后可以直接修改正文；复制、下载和保存使用同一份修改结果。标题、来源等 YAML 属性与正文分开编辑，保存时自动组合。重新生成正文前会确认是否覆盖手动修改。
- Chrome 扩展从当前标签页提取内容；Vessel 内置扩展由宿主直接传递当前网页数据（旧路径通过本地桥回退），避免读取到其他浏览器的旧页面。
- 本版本没有实现网页高亮管理、独立阅读模式或 AI Interpreter；不要求提供 AI 密钥。

开发后执行 `npm run build:clipper`，Vessel 重载内置扩展后生效；独立浏览器可使用新生成的 `vessel-clipper.zip`，解压并重新加载扩展目录。
