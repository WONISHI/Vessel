import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

export function TerminalPanel({ root, file }: { root: string; file?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [cwd, setCwd] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    if (!host.current) return
    let disposed = false
    let id: string | undefined
    const pending = new Map<string, string[]>()
    const terminal = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "Menlo, Consolas, monospace", scrollback: 5000, theme: { background: "#faf9f7", foreground: "#292524", cursor: "#15803d", selectionBackground: "#bbf7d0" } })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host.current)
    const resize = () => { fit.fit(); if (id) void window.electronAPI.terminalResize(id, terminal.cols, terminal.rows).catch(() => {}) }
    const observer = new ResizeObserver(resize)
    observer.observe(host.current)
    resize()
    const unsubscribe = window.electronAPI.onTerminalData((session, data) => {
      if (session === id) terminal.write(data)
      else if (!id) pending.set(session, [...(pending.get(session) || []), data])
    })
    const input = terminal.onData(data => { if (id) void window.electronAPI.terminalWrite(id, data).catch(reason => setError(String(reason))) })
    void window.electronAPI.terminalStart(root, file).then(session => {
      if (disposed) { void window.electronAPI.terminalClose(session.id); return }
      id = session.id
      setCwd(session.cwd)
      pending.get(id)?.forEach(data => terminal.write(data))
      pending.clear()
      resize()
      terminal.focus()
    }).catch(reason => { if (!disposed) setError(String(reason)) })
    return () => {
      disposed = true
      observer.disconnect(); unsubscribe(); input.dispose(); terminal.dispose()
      if (id) void window.electronAPI.terminalClose(id).catch(() => {})
    }
  }, [root, file])
  return <section aria-label="命令终端" className="flex h-full min-h-0 flex-col border-t bg-[#faf9f7]">
    <header className="flex items-center gap-3 border-b px-3 py-1 text-xs text-stone-500">
      <strong className="text-green-700">终端</strong><span className="min-w-0 flex-1 truncate" title={cwd}>{cwd || "正在启动…"}</span>
    </header>
    {error && <p role="alert" className="px-3 text-xs text-red-500">{error}</p>}
    <div ref={host} className="min-h-0 flex-1 overflow-hidden p-2" />
  </section>
}
