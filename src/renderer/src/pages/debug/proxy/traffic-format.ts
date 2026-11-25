export function formatTraffic(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let index = 0, number = Math.max(0, value)
  while (number >= 1024 && index < units.length - 1) { number /= 1024; index++ }
  return `${number.toFixed(index && number < 100 ? 1 : 0)} ${units[index]}`
}

