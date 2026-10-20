import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"
import { useEffect, useRef } from "react"

interface CachedSession {
  id?: string
  cwd: string
  disposed: boolean
  container: HTMLDivElement
  terminal: Terminal
  fit: FitAddon
  lastCols: number
  lastRows: number
  resizeCurrent?: () => void
  onCwdChange?: (cwd: string) => void
  onError?: (error: string) => void
  dispose: () => void
}

const sessionCache = new Map<string, CachedSession>()

/** Returns the cache key for a directory-scoped terminal session. */
function getSessionCacheKey(directory: string, sessionKey: number): string {
  return `${directory}::${sessionKey}`
}

/** Permanently disposes a cached terminal session and terminates its underlying pty process. */
export function disposeTerminalSession(directory: string, sessionKey: number): void {
  const cacheKey = getSessionCacheKey(directory, sessionKey)
  const cached = sessionCache.get(cacheKey)
  if (!cached) return
  sessionCache.delete(cacheKey)
  cached.dispose()
}

/** Renders a single persistent xterm.js session instance scoped to a folder. */
export function TerminalSession({
  root,
  directory,
  sessionKey,
  active,
  onCwdChange,
  onError
}: {
  root: string
  directory: string
  sessionKey: number
  active: boolean
  onCwdChange: (cwd: string) => void
  onError: (error: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const onCwdChangeRef = useRef(onCwdChange)
  const onErrorRef = useRef(onError)
  onCwdChangeRef.current = onCwdChange
  onErrorRef.current = onError

  useEffect(() => {
    const hostElement = host.current
    if (!hostElement) return
    const cacheKey = getSessionCacheKey(directory, sessionKey)
    let entry = sessionCache.get(cacheKey)

    if (!entry) {
      const container = document.createElement("div")
      container.className = "h-full w-full overflow-hidden"
      hostElement.appendChild(container)

      const pending = new Map<string, string[]>()
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "Menlo, Consolas, monospace",
        scrollback: 5000,
        theme: { background: "#faf9f7", foreground: "#292524", cursor: "#15803d", selectionBackground: "#bbf7d0" }
      })

      /** Updates terminal colors without restarting its shell session. */
      const updateTheme = () => {
        terminal.options.theme = document.documentElement.classList.contains("dark")
          ? { background: "#22272E", foreground: "#cdd9e5", cursor: "#4ade80", selectionBackground: "#34704c" }
          : { background: "#faf9f7", foreground: "#292524", cursor: "#15803d", selectionBackground: "#bbf7d0" }
      }
      updateTheme()
      const themeObserver = new MutationObserver(updateTheme)
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(container)
      if (container.clientWidth > 0 && container.clientHeight > 0) fit.fit()

      const createdEntry: CachedSession = {
        cwd: "",
        disposed: false,
        container,
        terminal,
        fit,
        lastCols: terminal.cols,
        lastRows: terminal.rows,
        /** Releases xterm resources and closes the main process pty session. */
        dispose: () => {
          createdEntry.disposed = true
          themeObserver.disconnect()
          unsubscribe()
          input.dispose()
          terminal.dispose()
          container.remove()
          if (createdEntry.id) void window.electronAPI.terminalClose(createdEntry.id).catch(() => {})
        }
      }

      const unsubscribe = window.electronAPI.onTerminalData((session, data) => {
        if (session === createdEntry.id) terminal.write(data)
        else if (!createdEntry.id) pending.set(session, [...(pending.get(session) || []), data])
      })
      const input = terminal.onData((data) => {
        if (createdEntry.id) void window.electronAPI.terminalWrite(createdEntry.id, data).catch((reason) => createdEntry.onError?.(String(reason)))
      })

      void window.electronAPI
        .terminalStart(root, directory, terminal.cols, terminal.rows)
        .then((session) => {
          if (createdEntry.disposed) {
            void window.electronAPI.terminalClose(session.id)
            return
          }
          createdEntry.id = session.id
          createdEntry.cwd = session.cwd
          createdEntry.onCwdChange?.(session.cwd)
          pending.get(session.id)?.forEach((data) => terminal.write(data))
          pending.clear()
          createdEntry.resizeCurrent?.()
          terminal.focus()
        })
        .catch((reason) => {
          if (!createdEntry.disposed) createdEntry.onError?.(String(reason))
        })

      entry = createdEntry
      sessionCache.set(cacheKey, entry)
    } else if (entry.container.parentElement !== hostElement) {
      hostElement.appendChild(entry.container)
    }

    const activeEntry = entry
    activeEntry.onCwdChange = (cwd) => onCwdChangeRef.current(cwd)
    activeEntry.onError = (err) => onErrorRef.current(err)
    if (activeEntry.cwd) onCwdChangeRef.current(activeEntry.cwd)

    let resizeFrame = 0

    /** Resizes terminal viewport and notifies main process pty only when grid dimensions change. */
    const resize = () => {
      if (!hostElement.isConnected || hostElement.clientWidth === 0 || hostElement.clientHeight === 0) return
      activeEntry.fit.fit()
      activeEntry.terminal.refresh(0, Math.max(0, activeEntry.terminal.rows - 1))
      if (activeEntry.id && (activeEntry.terminal.cols !== activeEntry.lastCols || activeEntry.terminal.rows !== activeEntry.lastRows)) {
        activeEntry.lastCols = activeEntry.terminal.cols
        activeEntry.lastRows = activeEntry.terminal.rows
        void window.electronAPI.terminalResize(activeEntry.id, activeEntry.terminal.cols, activeEntry.terminal.rows).catch(() => {})
      }
    }

    /** Schedules a single resize check on the next animation frame. */
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(resize)
    }

    activeEntry.resizeCurrent = resize
    scheduleResize()

    const observer = new ResizeObserver(scheduleResize)
    observer.observe(hostElement)

    return () => {
      cancelAnimationFrame(resizeFrame)
      observer.disconnect()
      if (activeEntry.resizeCurrent === resize) activeEntry.resizeCurrent = undefined
      activeEntry.onCwdChange = undefined
      activeEntry.onError = undefined
      if (activeEntry.container.parentElement === hostElement) {
        hostElement.removeChild(activeEntry.container)
      }
    }
  }, [root, directory, sessionKey])

  useEffect(() => {
    if (!active || !host.current) return
    const cacheKey = getSessionCacheKey(directory, sessionKey)
    const entry = sessionCache.get(cacheKey)
    if (!entry) return
    const frame = requestAnimationFrame(() => {
      if (!host.current || host.current.clientWidth === 0 || host.current.clientHeight === 0) return
      entry.fit.fit()
      entry.terminal.refresh(0, Math.max(0, entry.terminal.rows - 1))
      if (entry.id && (entry.terminal.cols !== entry.lastCols || entry.terminal.rows !== entry.lastRows)) {
        entry.lastCols = entry.terminal.cols
        entry.lastRows = entry.terminal.rows
        void window.electronAPI.terminalResize(entry.id, entry.terminal.cols, entry.terminal.rows).catch(() => {})
      }
      entry.terminal.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [active, directory, sessionKey])

  return (
    <div
      ref={host}
      className={active ? "h-full w-full overflow-hidden" : "hidden h-full w-full overflow-hidden"}
    />
  )
}

