/** Formats date. */
export function formatDate(date: Date) {
  const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"]
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${y}年${m}月${d}日 ${hh}:${mm} ${weekDays[date.getDay()]}`
}

/** Formats bytes. */
export function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
