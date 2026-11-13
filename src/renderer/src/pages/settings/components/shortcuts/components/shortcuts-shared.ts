import { shortcuts, type ShortcutId } from "@vessel/utils"
export const categories = ["全局与导航", "页面跳转", "浏览器", "编辑器", "Markdown", "截图"]

/** Performs the category operation. */
export function category(id: ShortcutId) {
  if (["openBrowser", "openWorkspace", "openApi", "openGit", "openTranslate", "openResources", "openDevtools"].includes(id)) return "页面跳转"
  const scope = shortcuts[id].scope as string
  if (scope === "Markdown 编辑器") return "Markdown"
  if (scope.startsWith("截图")) return "截图"
  if (scope === "浏览器") return "浏览器"
  if (["save", "undo", "redo", "goToLine"].includes(id)) return "编辑器"
  return "全局与导航"
}
