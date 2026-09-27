export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
export const fromKey = (key: string) => new Date(`${key}T12:00:00`)
const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" })
const digits = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
export function lunarLabel(date: Date, full = false) {
  const parts = lunar.formatToParts(date)
  const day = Number(parts.find((part) => part.type === "day")?.value)
  const month = parts.find((part) => part.type === "month")?.value || ""
  const label = day <= 10 ? (day === 10 ? "初十" : "初" + digits[day - 1]) : day < 20 ? "十" + digits[day - 11] : day === 20 ? "二十" : day < 30 ? "廿" + digits[day - 21] : "三十"
  return full ? `${month}${label}` : day === 1 ? month : label
}
export function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1, 12))
}

/** 节日名称与调休安排分开：这里不把节日当天推断为法定休假。 */
export function festivalLabel(date: Date): string | undefined {
  const solar: Record<string, string> = { "1-1": "元旦", "5-1": "劳动节", "6-1": "儿童节", "9-10": "教师节", "10-1": "国庆节" }
  const fixed = solar[`${date.getMonth() + 1}-${date.getDate()}`]
  if (fixed) return fixed
  const parts = lunar.formatToParts(date)
  const month = parts.find((part) => part.type === "month")?.value
  const day = Number(parts.find((part) => part.type === "day")?.value)
  const festivals: Record<string, string> = { "正月-1": "春节", "正月-15": "元宵节", "五月-5": "端午节", "七月-7": "七夕", "八月-15": "中秋节", "九月-9": "重阳节", "腊月-8": "腊八节" }
  return festivals[`${month}-${day}`]
}
