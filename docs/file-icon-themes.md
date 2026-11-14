# 文件图标库

入口：设置 → 外观 → 文件图标（默认折叠）。

- 默认图标库为“默认（当前图标）”，保持原来的图标展示。
- 默认应用到项目资源库；工作区默认不启用，两项可以独立勾选。
- 点击设置页“保存”后生效；支持设置导入、导出及重置。
- 作用于文件树（含文件夹展开状态）、文档标签、拆分文档标题、工作区首页文件和重命名预览。

## 集成资源

| 图标库 | 上游版本 | 完整 SVG 数量 | 可选配色 |
| --- | --- | --- | --- |
| [Catppuccin Icons](https://github.com/catppuccin/vscode-icons) | 1.26.0 | 3,280（5 套，每套 656） | 自动、Latte、Frappé、Macchiato、Mocha |
| [Symbols](https://github.com/miguelsolorio/vscode-symbols) | 0.0.25 | 371 | 上游原色 |

全部资源随应用离线打包，无需运行 VS Code 扩展。Catppuccin 的自动配色在浅色下使用 Latte、深色下使用 Mocha；上游 CSS Variables 原始资源也完整保留。设置中的“浏览完整图标库”展示全部独立图标，支持名称筛选；Symbols 中未出现在原关联表中的资源也补入浏览目录。

保留并使用上游文件名、复合扩展名、语言 ID、文件夹名称和根目录关联。文件名优先于扩展名，复合扩展名优先于单段扩展名，文件夹有展开图标时使用展开版本；未知类型使用该图标库的默认文件图标。语言 ID 可以由解析器参数指定，也为常见文件扩展名提供了语言推断。

## 维护

资源位于 `resources/file-icons/*.json.gz`，其中保存全部原始 SVG；许可证和来源、版本、资源哈希同目录保存。匹配表位于 `src/renderer/src/features/file-icons/*.json`。

重新导入已下载并解压的上游仓库：

```sh
node scripts/vendor-file-icon-themes.cjs /path/to/vscode-icons /path/to/vscode-symbols
```

该脚本只解析关联数据与复制 SVG，不运行上游扩展代码。`scripts/prepare-file-icon-assets.cjs` 将完整离线资源还原到被 Git 忽略的 `src/renderer/public/vendor/file-icons`，Electron Vite 的开发和构建流程会自动调用它。

验证包含资源完整性、全部关联引用、多段扩展名、大小写、展开文件夹、配色、应用范围、旧设置迁移及保存校验。

## 文件类型徽标

设置 → 外观 → 文件类型徽标（默认折叠）。这是文件树右侧的 `MD`、`XLSX` 等标记。显示开关和作用范围使用 shadcn Switch；文件图标库的作用范围也使用 Switch。

- `fileTypeBadgesEnabled` 默认 `false`，关闭时所有区域隐藏徽标。
- `fileTypeBadgesResources` 默认 `true`。
- `fileTypeBadgesWorkspace` 默认 `false`。

主开关开启且当前区域的范围开关开启时才显示；范围选择可以在主开关关闭时调整。设置支持保存、导入导出及重置，旧设置自动采用上述默认值。
