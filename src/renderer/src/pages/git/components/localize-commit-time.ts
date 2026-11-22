const units: Record<string, string> = { second: "秒", minute: "分钟", hour: "小时", day: "天", week: "周", month: "个月", year: "年" }

/** The graph bundles its own DayJS instance and exposes no locale option. */
export function localizeCommitTime(value: string): string {
  const match = /^(?:(in) )?(a few|an?|\d+) (seconds?|minutes?|hours?|days?|weeks?|months?|years?)( ago)?$/.exec(value.trim())
  if (!match || (!match[1] && !match[4])) return value
  const count = match[2] === "a few" ? "几" : /^an?$/.test(match[2]) ? "1" : match[2]
  const unit = units[match[3].replace(/s$/, "")]
  return `${count}${count === "几" ? "" : " "}${unit}${match[1] ? "后" : "前"}`
}
