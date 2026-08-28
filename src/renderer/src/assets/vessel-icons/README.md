# Vessel 图标包

本图标包包含 Vessel 笔记应用所需的所有图标，采用线条风格（stroke），24x24 viewBox，与 FlexNote 设计风格一致。

## 目录结构

```
vessel-icons/
├── file-types/    # 文件类型图标（62 个）
├── ui/            # UI 图标（131 个）
└── README.md      # 说明文档
```

## 使用方式

所有图标均为 SVG 格式，`stroke="currentColor"`，可通过 CSS `color` 属性控制颜色。

### React 中使用

```tsx
import FileIcon from "@/icons/file-types/md.svg"

// 或者内联使用
import { ReactComponent as MdIcon } from "@/icons/file-types/md.svg"
```

### HTML 中使用

```html
<img src="/icons/file-types/md.svg" alt="Markdown" width="16" height="16" />
```

### 自定义颜色

```css
.icon {
  color: #15803d; /* 图标颜色 */
  width: 16px;
  height: 16px;
}
```

## 文件类型图标（62 个）

### 文档类
- `md.svg`, `markdown.svg` - Markdown（绿色）
- `txt.svg` - 纯文本（灰色）
- `pdf.svg` - PDF（红色）
- `doc.svg`, `docx.svg` - Word（蓝色）
- `xls.svg`, `xlsx.svg` - Excel（绿色）
- `ppt.svg`, `pptx.svg` - PowerPoint（橙色）

### 前端类
- `js.svg`, `jsx.svg` - JavaScript（黄色）
- `ts.svg`, `tsx.svg` - TypeScript（蓝色）
- `css.svg` - CSS（蓝色）
- `scss.svg` - SCSS（粉色）
- `less.svg` - LESS（深蓝）
- `html.svg` - HTML（橙色）
- `vue.svg` - Vue（绿色）
- `svelte.svg` - Svelte（橙色）
- `astro.svg` - Astro（黑色）

### 数据/配置类
- `json.svg` - JSON（黑色）
- `xml.svg` - XML（棕色）
- `yaml.svg`, `yml.svg` - YAML（黄色）
- `env.svg` - 环境变量（绿色）
- `config.svg` - 配置（灰色）
- `lock.svg` - Lock 文件（灰色）
- `log.svg` - 日志（灰色）
- `sql.svg`, `db.svg` - 数据库（青色）

### 图片类
- `png.svg`, `jpg.svg`, `jpeg.svg`, `gif.svg`, `webp.svg`, `ico.svg` - 图片（紫色）
- `svg.svg` - SVG（红色）

### 后端/语言类
- `py.svg` - Python（蓝色）
- `java.svg` - Java（橙色）
- `go.svg` - Go（青色）
- `rs.svg` - Rust（红色）
- `c.svg`, `cpp.svg`, `h.svg` - C/C++（灰色）
- `cs.svg` - C#（紫色）
- `php.svg` - PHP（紫色）
- `rb.svg` - Ruby（红色）
- `swift.svg` - Swift（橙色）
- `kt.svg` - Kotlin（紫色）
- `dart.svg` - Dart（蓝色）
- `sh.svg`, `bash.svg` - Shell（黑色）

### 压缩包类
- `zip.svg`, `rar.svg`, `7z.svg`, `tar.svg`, `gz.svg` - 压缩包（黄色）

### 通用
- `file.svg` - 通用文件
- `folder.svg` - 文件夹
- `folder-open.svg` - 打开的文件夹

## UI 图标（131 个）

### 导航
- `back.svg`, `forward.svg`
- `arrow-right.svg`, `arrow-left.svg`, `arrow-up.svg`, `arrow-down.svg`
- `external-link.svg`
- `chevron-right.svg`, `chevron-left.svg`, `chevron-down.svg`, `chevron-up.svg`

### 操作
- `undo.svg`, `redo.svg`, `refresh.svg`
- `save.svg`, `share.svg`
- `copy.svg`, `cut.svg`, `paste.svg`
- `delete.svg`, `edit.svg`
- `download.svg`, `upload.svg`
- `plus.svg`, `minus.svg`
- `check.svg`, `x.svg`, `close.svg`

### 富文本编辑
- `bold.svg`, `italic.svg`, `strikethrough.svg`
- `code.svg`, `code-block.svg`
- `link.svg`, `image.svg`, `table.svg`
- `list.svg`, `list-ordered.svg`, `list-check.svg`
- `quote.svg`, `heading.svg`
- `h1.svg`, `h2.svg`, `h3.svg`

### 视图
- `preview.svg`, `eye.svg`, `eye-off.svg`
- `fullscreen.svg`, `maximize.svg`, `minimize.svg`
- `outline.svg`, `sidebar.svg`, `panel.svg`, `columns.svg`, `grid.svg`
- `collapse.svg`, `expand.svg`

### 工具
- `search.svg`, `settings.svg`
- `history.svg`, `clock.svg`, `calendar.svg`, `bell.svg`
- `filter.svg`, `sort.svg`
- `menu.svg`, `more.svg`, `more-horizontal.svg`, `more-vertical.svg`
- `command.svg`, `terminal.svg`

### 状态
- `info.svg`, `alert.svg`, `warning.svg`, `help.svg`, `question.svg`
- `check-circle.svg`, `x-circle.svg`, `alert-circle.svg`, `info-circle.svg`, `help-circle.svg`

### 其他
- `home.svg`, `book.svg`, `star.svg`, `tag.svg`
- `user.svg`, `users.svg`
- `lock.svg`, `unlock.svg`
- `paperclip.svg`, `folder-search.svg`, `file-search.svg`, `file-edit.svg`, `file-code.svg`
- `package.svg`, `database.svg`, `cloud.svg`, `globe.svg`, `wifi.svg`
- `zap.svg`, `sparkles.svg`, `shield.svg`, `heart.svg`, `thumbs-up.svg`
- `message.svg`, `mail.svg`, `phone.svg`
- `printer.svg`, `camera.svg`, `music.svg`, `video.svg`, `mic.svg`, `headphones.svg`
- `gift.svg`, `flag.svg`, `bookmark.svg`, `archive.svg`, `trash.svg`
- `download-cloud.svg`, `upload-cloud.svg`
- `layers.svg`, `activity.svg`, `trending-up.svg`, `trending-down.svg`
- `pie-chart.svg`, `bar-chart.svg`, `target.svg`, `compass.svg`, `map.svg`, `navigation.svg`, `locate.svg`

## 设计规范

- **尺寸**: 24x24 viewBox
- **风格**: 线条（stroke），2px 线宽
- **颜色**: `currentColor`，可通过 CSS 控制
- **圆角**: `stroke-linecap: round`, `stroke-linejoin: round`
- **配色参考**:
  - 主色: `#1c1917`（近黑）
  - 强调色: `#15803d`（深绿）
  - 次要文字: `#78716c`（中灰）
  - 辅助文字: `#a8a29e`（浅灰）

## 许可证

本图标包可自由使用于 Vessel 项目及其他个人/商业项目。
