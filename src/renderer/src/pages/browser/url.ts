/** 将地址或搜索词转换为浏览器可加载的 HTTP(S)、扩展或本地文件地址。 */
export function browserURL(input: string): string {
  const value = input.trim()
  if (!value) return ""
  if (/^(https?|chrome-extension|file):\/\//i.test(value)) return new URL(value).href
  if (/^[a-z][\w+.-]*:/i.test(value) && !/^[\w.-]+:\d+(?:\/|$)/.test(value)) throw new Error("仅支持 HTTP、HTTPS、chrome-extension 和 file 地址")
  if (!/\s/.test(value) && /^(localhost|[\w-]+(?:\.[\w-]+)+)(:\d+)?(?:[/?#]|$)/i.test(value)) {
    return new URL(`${/^(localhost|127\.)/.test(value) ? "http" : "https"}://${value}`).href
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(value)}`
}
