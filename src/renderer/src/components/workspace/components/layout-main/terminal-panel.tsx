import { disposeTerminalSession, TerminalSession } from "@/components/workspace/components/layout-main/terminal-session"
import { Plus, SquareTerminal, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface TerminalSessionItem {
  key: number
  index: number
}

interface WorkspaceTerminalPanelState {
  nextKey: number
  sessions: TerminalSessionItem[]
  activeKey: number
  cwds: Record<number, string>
}

const panelStateCache = new Map<string, WorkspaceTerminalPanelState>()

/** Resolves the folder path that owns the terminal panel for a given file or workspace root. */
export function resolveTerminalDirectory(root: string, file?: string): string {
  if (!file) return root
  const split = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"))
  return split >= root.length ? file.slice(0, split) : root
}

/** Renders the terminal panel component. */
export function TerminalPanel({ root, file, onClose }: { root: string; file?: string; onClose?: () => void }) {
  const targetDir = resolveTerminalDirectory(root, file)
  const cached = panelStateCache.get(targetDir)
  const nextKey = useRef(cached?.nextKey ?? 2)
  const [sessions, setSessions] = useState<TerminalSessionItem[]>(() => cached?.sessions ?? [{ key: 1, index: 1 }])
  const [activeKey, setActiveKey] = useState(() => cached?.activeKey ?? 1)
  const [cwds, setCwds] = useState<Record<number, string>>(() => cached?.cwds ?? {})
  const [error, setError] = useState("")

  useEffect(() => {
    panelStateCache.set(targetDir, {
      nextKey: nextKey.current,
      sessions,
      activeKey,
      cwds
    })
  }, [targetDir, sessions, activeKey, cwds])

  /** Creates a new terminal session and switches to it. */
  const handleCreateTerminal = () => {
    if (sessions.length >= 8) {
      setError("最多同时打开 8 个终端")
      return
    }
    setError("")
    const key = nextKey.current++
    const nextIndex = sessions.length > 0 ? Math.max(...sessions.map((item) => item.index)) + 1 : 1
    setSessions((prev) => [...prev, { key, index: nextIndex }])
    setActiveKey(key)
  }

  /** Kills the active terminal session, or closes the panel when the last session is removed. */
  const handleDeleteTerminal = () => {
    setError("")
    disposeTerminalSession(targetDir, activeKey)
    if (sessions.length <= 1) {
      panelStateCache.delete(targetDir)
      if (onClose) {
        onClose()
        return
      }
      const key = nextKey.current++
      setCwds({})
      setSessions([{ key, index: 1 }])
      setActiveKey(key)
      return
    }
    const currentIdx = sessions.findIndex((item) => item.key === activeKey)
    const remaining = sessions.filter((item) => item.key !== activeKey)
    const fallback = remaining[Math.max(0, currentIdx - 1)] ?? remaining[0]
    setSessions(remaining)
    setCwds((prev) => {
      const next = { ...prev }
      delete next[activeKey]
      return next
    })
    if (fallback) setActiveKey(fallback.key)
  }

  const activeCwd = cwds[activeKey] || ""

  return (
    <section
      aria-label="命令终端"
      className="flex h-full min-h-0 flex-col bg-[#faf9f7] dark:bg-[#22272E]"
    >
      <header className="flex h-8 shrink-0 items-center gap-2.5 border-b border-stone-200/90 px-3 text-xs text-stone-500 dark:border-[#373e47] dark:text-[#768390]">
        <strong className="shrink-0 font-semibold text-green-700 dark:text-[#4ade80]">终端</strong>
        {sessions.length > 1 && (
          <div
            role="tablist"
            aria-label="终端会话列表"
            className="flex shrink-0 items-center gap-1"
          >
            {sessions.map((item) => {
              const isCurrent = item.key === activeKey
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => setActiveKey(item.key)}
                  className={
                    isCurrent
                      ? "inline-flex items-center gap-1 rounded bg-stone-200/90 px-1.5 py-0.5 text-xs font-medium text-stone-800 dark:bg-[#373e47] dark:text-[#cdd9e5]"
                      : "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-stone-500 transition-colors hover:bg-stone-200/50 dark:text-[#768390] dark:hover:bg-[#2d333b]"
                  }
                >
                  <SquareTerminal className={isCurrent ? "size-3 text-green-700 dark:text-[#4ade80]" : "size-3"} />
                  <span>{item.index}: zsh</span>
                </button>
              )
            })}
          </div>
        )}
        <span
          className="min-w-0 flex-1 truncate"
          data-title={activeCwd}
        >
          {activeCwd || "正在启动…"}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="新建终端"
            title="新建终端 (New Terminal)"
            onClick={handleCreateTerminal}
            className="flex size-6 items-center justify-center rounded text-stone-600 transition-colors hover:bg-stone-200/90 hover:text-stone-900 active:bg-stone-300/70 dark:text-[#adbac7] dark:hover:bg-[#373e47] dark:hover:text-white dark:active:bg-[#444c56]"
          >
            <Plus className="size-3.5" />
          </button>
          <span
            aria-hidden="true"
            className="mx-0.5 h-3.5 w-px bg-stone-300/80 dark:bg-[#373e47]"
          />
          <button
            type="button"
            aria-label="删除终端"
            title="终止终端 (Kill Terminal)"
            onClick={handleDeleteTerminal}
            className="flex size-6 items-center justify-center rounded text-stone-600 transition-colors hover:bg-stone-200/90 hover:text-red-600 active:bg-red-100 dark:text-[#adbac7] dark:hover:bg-[#373e47] dark:hover:text-[#f87171] dark:active:bg-[#444c56]"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="px-3 text-xs text-red-500"
        >
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-hidden px-2 pt-2 pb-[9.6px]">
        {sessions.map((item) => (
          <TerminalSession
            key={item.key}
            sessionKey={item.key}
            root={root}
            directory={targetDir}
            active={item.key === activeKey}
            onCwdChange={(cwd) => setCwds((prev) => (prev[item.key] === cwd ? prev : { ...prev, [item.key]: cwd }))}
            onError={setError}
          />
        ))}
      </div>
    </section>
  )
}

