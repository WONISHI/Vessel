/** Formats a local calendar day without UTC timezone shifts. */
export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Parses ISO property dates while rejecting rolled-over or unrelated text values. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return calendarDateKey(date) === match.slice(1).join("-") ? date : null
}

/** Builds a Monday-first month grid including adjacent-month days. */
export function calendarMonthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const offset = (first.getDay() + 6) % 7
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1, 12))
}
