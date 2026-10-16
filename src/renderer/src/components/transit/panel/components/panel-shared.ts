/** Formats transit date. */
export function formatTransitDate(date: Date) {
  /** Performs the pad operation. */
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())} 星期${"日一二三四五六"[date.getDay()]}`
}
