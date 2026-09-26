import { getFileExtension } from "@vessel/utils"

/** 根据扩展名选择侧栏标签和配色，供文件树行展示使用。
 * @param name 文件名。
 * @returns 显示标签、图标颜色和标签背景样式。
 */
export function getFilePresentation(name: string) {
  const extension = getFileExtension(name)
  if (["md", "markdown"].includes(extension)) return { label: "MD", color: "text-violet-500", badge: "bg-violet-100 text-violet-600" }
  if (["ts", "tsx"].includes(extension)) return { label: extension.toUpperCase(), color: "text-blue-500", badge: "bg-blue-100 text-blue-600" }
  if (["js", "jsx", "json"].includes(extension)) return { label: extension.toUpperCase(), color: "text-amber-500", badge: "bg-amber-100 text-amber-600" }
  if (extension === "vue") return { label: "Vue", color: "text-green-600", badge: "bg-green-100 text-green-600" }
  return { label: extension.toUpperCase(), color: "text-stone-400", badge: "bg-stone-100 text-stone-500" }
}
