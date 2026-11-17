import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { useEffect, useState, useMemo } from "react"
import { isQuickOpenPath } from "../searchable-path"

/** Searches filenames and literal document contents, discarding stale responses as the query changes. */
export function useFileSearch(root: string, query: string) {
  const [files, setFiles] = useState<WorkspaceNode[]>([])
  const [contentFiles, setContentFiles] = useState<WorkspaceNode[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [limited, setLimited] = useState(false)
  const [indexing, setIndexing] = useState(false)
  useEffect(() => {
    setFiles([])
    if (!root) { setIndexing(false); return }
    setIndexing(true)
    let cancelled = false
    const pending = [root]
    const collected: WorkspaceNode[] = []

    /** Indexes filenames across the entire workspace, independently of tree visibility settings. */
    const scan = async () => {
      try {
        let publishedAt = 0
        let cursor = 0
        while (cursor < pending.length && !cancelled) {
          const directory = pending[cursor++]
          const nodes = await window.electronAPI.readWorkspaceDirectory(root, directory, { includeIgnored: true }).catch((reason) => {
            if (!cancelled) setError(String(reason))
            return []
          })
          for (const node of nodes) {
            if (!isQuickOpenPath(node.path)) continue
            if (node.type === "directory") {
              pending.push(node.path)
              collected.push(node)
            } else collected.push(node)
          }
          if (!cancelled && performance.now() - publishedAt >= 200) {
            publishedAt = performance.now()
            setFiles([...collected])
          }
        }
        if (!cancelled) setFiles([...collected])
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
        .searchContent({ root, query: query.trim(), regex: false, caseSensitive: false, exclude: "**/node_modules/**,**/.git/**" })
        .then((result) => {
          if (cancelled) return
          setContentFiles([...new Map(result.matches.filter((match) => isQuickOpenPath(match.path)).map((match) => [match.path, { name: match.path.split(/[\\/]/).pop() || match.path, path: match.path, type: "file" as const }])).values()])
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
  const matches = useMemo(() => [...new Map([...files.filter((file) => file.path.toLocaleLowerCase().includes(keyword)), ...contentFiles].map((file) => [file.path, file])).values()], [files, contentFiles, keyword])
  return { files: matches, busy: busy || indexing, error, limited }
}
