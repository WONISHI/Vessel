import type { KeyInput, ShortcutId } from "@vessel/type"

export { type KeyInput, type ShortcutId } from "@vessel/type"

/** One registry for shortcut handlers and the settings reference. Editor-native keys are scoped explicitly. */
export const shortcuts = {
  selectWorkspace: { label: "选择工作区", key: "e", mod: true, shift: true, scope: "全局" },
  findWorkspaceFiles: { label: "查找工作区文件", key: "f", mod: true, shift: true, scope: "全局" },
  visitLink: { label: "访问链接", key: "l", mod: true, shift: true, scope: "全局" },
  reloadApp: { label: "刷新页面", key: "r", mod: true, shift: true, scope: "全局" },
  toggleTheme: { label: "切换主题", key: "d", mod: true, shift: true, scope: "全局" },
  showControls: { label: "显示控制按钮", key: "y", mod: true, shift: true, scope: "全局" },
  hideControls: { label: "关闭控制按钮", key: "u", mod: true, shift: true, scope: "全局" },
  command: { label: "命令菜单", key: "p", mod: true, scope: "全局" },
  find: { label: "页面 / 文档查找", key: "f", mod: true, scope: "浏览器、编辑器" },
  scrollTop: { label: "返回顶部", key: "a", ctrl: true, shift: true, scope: "悬停 / 聚焦的滚动区域" },
  scrollBottom: { label: "返回底部", key: "z", ctrl: true, shift: true, scope: "悬停 / 聚焦的滚动区域" },
  goToLine: { label: "跳转到行", key: "g", mod: true, scope: "代码编辑器" },
  sidebar: { label: "切换侧边栏", key: "b", mod: true, scope: "工作区" },
  devtools: { label: "切换网页开发者工具", key: "F12", scope: "浏览器" },
  refreshBrowser: { label: "刷新当前网页", key: "F5", scope: "浏览器" },
  previousTab: { label: "上一个文档标签", key: "l", ctrl: true, scope: "工作区、项目资源库" },
  nextTab: { label: "下一个文档标签", key: "r", ctrl: true, scope: "工作区、项目资源库" },
  save: { label: "保存", key: "s", mod: true, scope: "编辑器" },
  undo: { label: "撤销", key: "z", mod: true, scope: "编辑器、截图" },
  redo: { label: "重做", key: "y", mod: true, scope: "编辑器" },
  bold: { label: "加粗", key: "b", mod: true, scope: "Markdown 编辑器" },
  italic: { label: "斜体", key: "i", mod: true, scope: "Markdown 编辑器" },
  headings: { label: "标题", key: "h", mod: true, shift: false, scope: "Markdown 编辑器" },
  strike: { label: "删除线", key: "d", mod: true, shift: false, scope: "Markdown 编辑器" },
  link: { label: "插入链接", key: "k", mod: true, shift: false, scope: "Markdown 编辑器" },
  emoji: { label: "表情", key: "e", mod: true, shift: false, scope: "Markdown 编辑器" },
  list: { label: "无序列表", key: "l", mod: true, shift: false, scope: "Markdown 编辑器" },
  "ordered-list": { label: "有序列表", key: "o", mod: true, shift: false, scope: "Markdown 编辑器" },
  check: { label: "任务列表", key: "j", mod: true, shift: false, scope: "Markdown 编辑器" },
  quote: { label: "引用", key: ";", mod: true, shift: false, scope: "Markdown 编辑器" },
  line: { label: "分隔线", key: "h", mod: true, shift: true, scope: "Markdown 编辑器" },
  code: { label: "代码块", key: "u", mod: true, shift: false, scope: "Markdown 编辑器" },
  "inline-code": { label: "行内代码", key: "g", mod: true, shift: false, scope: "Markdown 编辑器" },
  table: { label: "表格", key: "m", mod: true, scope: "Markdown 编辑器" },
  pinScreenshot: { label: "截图钉到桌面", key: "F3", scope: "截图" },
  copyColor: { label: "复制色值", key: "c", scope: "截图取色" }
} satisfies Record<ShortcutId, { label: string; key: string; scope: string; mod?: boolean; ctrl?: boolean; shift?: boolean }>

/** Performs the matches shortcut operation. */
export function matchesShortcut(event: KeyInput, id: ShortcutId) {
  const item: { key: string; mod?: boolean; ctrl?: boolean; shift?: boolean } = shortcuts[id]
  const ctrl = !!(event.ctrlKey || event.control),
    meta = !!(event.metaKey || event.meta)
  return !event.isComposing && !(event.altKey || event.alt) && !!(event.shiftKey || event.shift) === !!item.shift && event.key.toLowerCase() === item.key.toLowerCase() && (item.mod ? ctrl || meta : item.ctrl ? ctrl && !meta : !ctrl && !meta)
}

/** Performs the shortcut label operation. */
export function shortcutLabel(id: ShortcutId, mac: boolean) {
  const item: { key: string; mod?: boolean; ctrl?: boolean; shift?: boolean } = shortcuts[id]
  return [item.mod ? (mac ? "⌘" : "Ctrl") : item.ctrl ? "Ctrl" : "", item.shift ? "Shift" : "", item.key.toUpperCase()].filter(Boolean).join(" + ")
}

export const screenshotShortcut = { label: "端外截图", scope: "全局", mac: "Control+X", windows: "F1" }

/** Performs the markdown hotkey operation. */
export function markdownHotkey(id: ShortcutId) {
  const item: { key: string; mod?: boolean; shift?: boolean } = shortcuts[id]
  return `${item.shift ? "⇧" : ""}${item.mod ? "⌘" : ""}${item.key.toUpperCase()}`
}

/** Commands available both in the app shell and focused browser guests. */
export const commandShortcutIds = ["command", "selectWorkspace", "findWorkspaceFiles", "visitLink", "reloadApp", "toggleTheme", "showControls", "hideControls"] as const
