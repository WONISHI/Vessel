import type { MindElixirData } from "mind-elixir"

/** Creates a portable Mind Elixir document without loading the editor bundle. */
export function createMindmapDocument(name = "中心主题"): string {
  return JSON.stringify({ nodeData: { id: crypto.randomUUID(), topic: name.replace(/\.mind$/i, ""), root: true, children: [{ id: crypto.randomUUID(), topic: "分支主题" }] }, direction: 2 }, null, 2)
}

/** Validates a document before mounting; malformed files are never overwritten. */
export function parseMindmapDocument(raw: string): MindElixirData {
  const data = JSON.parse(raw)
  if (!data || typeof data !== "object" || !data.nodeData) throw new Error("不是有效的思维导图文件")
  const pending: unknown[] = [data.nodeData]
  const ids = new Set<string>()
  while (pending.length) {
    const node = pending.pop() as Record<string, unknown> | null
    if (!node || typeof node !== "object" || typeof node.id !== "string" || !node.id || typeof node.topic !== "string" || ids.has(node.id)) throw new Error("思维导图节点无效或 ID 重复")
    ids.add(node.id)
    if (ids.size > 10000) throw new Error("思维导图超过 10000 个节点")
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw new Error("思维导图子节点格式无效")
      pending.push(...node.children)
    }
  }
  return data as MindElixirData
}

/** Serializes writes so older snapshots cannot overwrite newer edits. */
export function createMindmapWriter(write: (text: string) => Promise<unknown>) {
  let queue = Promise.resolve()
  return (text: string) => {
    const result = queue.then(() => write(text)).then(() => {})
    queue = result.catch(() => {})
    return result
  }
}
