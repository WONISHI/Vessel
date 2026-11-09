import type { KV } from "@/pages/postman/lib/model"

/** Splits a URL into base / query / hash without URL parsing, so `{{baseUrl}}` templates survive. */
export function splitUrl(url: string): { base: string; query: string | null; hash: string } {
  const hashIndex = url.indexOf("#")
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex)
  const queryIndex = withoutHash.indexOf("?")
  return queryIndex === -1 ? { base: withoutHash, query: null, hash } : { base: withoutHash.slice(0, queryIndex), query: withoutHash.slice(queryIndex + 1), hash }
}

/** Query string → enabled rows, keeping text exactly as typed (no decoding). */
export function parseQuery(query: string | null): KV[] {
  if (!query) return []
  return query
    .split("&")
    .filter((segment) => segment !== "")
    .map((segment) => {
      const index = segment.indexOf("=")
      return index === -1 ? { key: segment, value: "", enabled: true } : { key: segment.slice(0, index), value: segment.slice(index + 1), enabled: true }
    })
}

/** Enabled rows → query string. */
export function buildQuery(rows: KV[]): string {
  return rows
    .filter((row) => row.enabled && (row.key || row.value))
    .map((row) => (row.value === "" ? row.key : `${row.key}=${row.value}`))
    .join("&")
}

/** URL edited → params table: rows parsed from the URL, followed by the disabled rows the URL cannot hold. */
export function paramsFromUrl(url: string, current: KV[]): KV[] {
  return [...parseQuery(splitUrl(url).query), ...current.filter((row) => !row.enabled)]
}

/** Params table edited → URL with the enabled rows as its query string. */
export function urlWithParams(url: string, params: KV[]): string {
  const { base, hash } = splitUrl(url)
  const query = buildQuery(params)
  return `${base}${query ? `?${query}` : ""}${hash}`
}
