import { shortcuts, type ShortcutId } from "@vessel/utils"
export const categories = ["全局与导航", "浏览器", "编辑器", "Markdown", "截图"]

/** Performs the category operation. */
export function category(id: ShortcutId) {
  const scope = shortcuts[id].scope as string
  if (scope === "Markdown 编辑器") return "Markdown"
  if (scope.startsWith("截图")) return "截图"
  if (scope === "浏览器") return "浏览器"
  if (["save", "undo", "redo", "goToLine"].includes(id)) return "编辑器"
  return "全局与导航"
}
