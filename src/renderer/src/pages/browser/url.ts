export const searchEngines = {
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  baidu: { label: "百度", url: "https://www.baidu.com/s?wd=" },
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
} as const

export type SearchEngine = keyof typeof searchEngines
let searchEngine: SearchEngine = "bing"
const listeners = new Set<() => void>()

export const getSearchEngine = () => searchEngine
export const subscribeSearchEngine = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Sets search engine. */
export const setSearchEngine = (engine: string) => {
  const next = Object.hasOwn(searchEngines, engine) ? engine as SearchEngine : "bing"
  if (next === searchEngine) return
  searchEngine = next
  listeners.forEach((listener) => listener())
}
/** 将地址或搜索词转换为浏览器可加载的 HTTP(S)、扩展或本地文件地址。 */
export function browserURL(input: string): string {
  const value = input.trim()
  if (!value) return ""
  if (/^(https?|chrome-extension|file):\/\//i.test(value)) return new URL(value).href
  if (/^[a-z][\w+.-]*:/i.test(value) && !/^[\w.-]+:\d+(?:\/|$)/.test(value)) throw new Error("仅支持 HTTP、HTTPS、chrome-extension 和 file 地址")
  if (!/\s/.test(value) && /^(localhost|[\w-]+(?:\.[\w-]+)+)(:\d+)?(?:[/?#]|$)/i.test(value)) {
    return new URL(`${/^(localhost|127\.)/.test(value) ? "http" : "https"}://${value}`).href
  }
  return searchEngines[searchEngine].url + encodeURIComponent(value)
}
