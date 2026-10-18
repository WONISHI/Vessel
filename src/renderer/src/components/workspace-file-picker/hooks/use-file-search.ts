import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { useEffect, useState } from "react"

/** Searches filenames and literal document contents, discarding stale responses as the query changes. */
export function useFileSearch(root: string, query: string) {
  const [files, setFiles] = useState<WorkspaceNode[]>([])
  const [contentFiles, setContentFiles] = useState<WorkspaceNode[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [limited, setLimited] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [indexLimited, setIndexLimited] = useState(false)
  useEffect(() => {
    setFiles([])
    setIndexLimited(false)
    if (!root) { setIndexing(false); return }
    setIndexing(true)
    let cancelled = false
    const pending = [root]
    const collected: WorkspaceNode[] = []

    /** Indexes filenames using the existing workspace directory reader and its configured exclusions. */
    const scan = async () => {
      try {
        let count = 0
        while (pending.length && count++ < 10000 && collected.length < 20000 && !cancelled) {
          const directory = pending.shift()!
          const nodes = await window.electronAPI.readWorkspaceDirectory(root, directory).catch((reason) => {
            if (!cancelled) setError(String(reason))
            return []
          })
          for (const node of nodes) {
            if (node.type === "directory") {
              if (!["node_modules", ".git", ".pnpm-store"].includes(node.name)) {
                pending.push(node.path)
                collected.push(node)
              }
            } else collected.push(node)
          }
          if (!cancelled && count % 25 === 0) setFiles([...collected])
        }
        if (!cancelled) setFiles([...collected])
        if (!cancelled && pending.length) setIndexLimited(true)
      } catch (reason) {
        if (!cancelled) setError(String(reason))
      } finally {
        if (!cancelled) setIndexing(false)
      }
    }
    void scan()
    return () => {
      cancelled = true
    }
  }, [root])
  useEffect(() => {
    setContentFiles([])
    setError("")
    setLimited(false)
    if (!root || !query.trim()) {
      setBusy(false)
      return
    }
    let cancelled = false
    setBusy(true)
    const timer = setTimeout(() => {
      void window.electronAPI
        .searchContent({ root, query: query.trim(), regex: false, caseSensitive: false })
        .then((result) => {
          if (cancelled) return
          setContentFiles([...new Map(result.matches.map((match) => [match.path, { name: match.path.split(/[\\/]/).pop() || match.path, path: match.path, type: "file" as const }])).values()])
          if (result.truncated) setLimited(true)
        })
        .catch((reason) => {
          if (!cancelled) setError(String(reason))
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [root, query])
  const keyword = query.trim().toLocaleLowerCase()
  return { files: [...new Map([...files.filter((file) => file.path.toLocaleLowerCase().includes(keyword)), ...contentFiles].map((file) => [file.path, file])).values()], busy: busy || indexing, error, limited: limited || indexLimited }
}
