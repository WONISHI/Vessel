import { useEffect, useState } from "react"
import { FolderOpen, Play, Square, ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Project = Awaited<ReturnType<typeof window.electronAPI.sourceProjectStatus>>

/** Starts an isolated Vite service using the selected project's installed dependencies. */
export function SourceProjectDialog({ open, onOpenChange, onNavigate }: { open: boolean; onOpenChange: (value: boolean) => void; onNavigate: (url: string) => void }) {
  const [root, setRoot] = useState("")
  const [config, setConfig] = useState("")
  const [mode, setMode] = useState("development")
  const [port, setPort] = useState("")
  const [project, setProject] = useState<Project>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    let active = true
    const refresh = () => window.electronAPI.sourceProjectStatus().then(value => { if (active) { setProject(value); if (value) setRoot(current => current || value.root) } }).catch(error => { if (active) setError(String(error)) })
    void refresh()
    const timer = setInterval(() => { void refresh() }, 1500)
    return () => { active = false; clearInterval(timer) }
  }, [open])
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError("")
    try { await action() } catch (error) { setError(String(error)) } finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
    {open && <DialogPortal><div aria-hidden="true" className="fixed top-0 right-0 bottom-8 left-[52px] z-[230] bg-black/[.04] backdrop-blur-[3px]" /></DialogPortal>}
    <DialogContent className="z-[231] max-h-[calc(100vh-64px)] overflow-y-auto max-w-md gap-3 p-4 left-[calc(50%+26px)] w-[calc(100vw-84px)]">
      <DialogHeader><DialogTitle className="text-base">本地项目调试</DialogTitle><DialogDescription className="text-xs">Vue 3 + Vite · 临时接入元素定位，不修改项目源文件、配置或依赖清单。使用项目已有的 Node 环境与依赖，每次可运行一个项目。</DialogDescription></DialogHeader>
      <div className="space-y-2.5 text-xs [&_input]:h-8 [&_input]:text-xs">
        <label className="block space-y-1.5"><span>项目目录</span><div className="flex gap-2"><Input aria-label="项目目录" value={root} readOnly placeholder="选择包含 Vite 配置的目录" /><Button variant="outline" size="sm" className="h-8 shrink-0 hover:!bg-green-600 hover:!text-white [&:hover_svg]:!text-white" disabled={busy || project?.running} aria-label="选择项目目录" onClick={() => { void run(async () => { const value = await window.electronAPI.sourceProjectPick(); if (value) setRoot(value) }) }}><FolderOpen /></Button></div></label>
        <label className="block space-y-1.5"><span>Vite 配置文件（可选，相对于项目目录）</span><Input value={config} onChange={event => setConfig(event.target.value)} placeholder="留空自动查找 vite.config.ts" disabled={busy || project?.running} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1.5"><span>环境模式</span><Input value={mode} onChange={event => setMode(event.target.value)} disabled={busy || project?.running} /></label><label className="space-y-1.5"><span>端口（可选）</span><Input type="number" min={1} max={65535} value={port} onChange={event => setPort(event.target.value)} placeholder="使用项目配置" disabled={busy || project?.running} /></label></div>
        <p className="text-muted-foreground">启动后打开页面，点击工具栏“定位源码”，选择高亮元素即可打开 VS Code / WebStorm；Esc 退出。暂不支持 HTTPS、Pug、外部模板和 iframe 内部元素。项目启动脚本中的前置任务需自行运行。</p>
        {project && <div className="rounded-md border p-3"><p>{project.running ? "运行中" : "已停止"} · {project.url || "正在启动…"}</p><details className="mt-2"><summary className="cursor-pointer text-muted-foreground">开发服务日志</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px]">{project.logs || "暂无日志"}</pre></details></div>}
        {error && <pre role="alert" className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-red-500">{error}</pre>}
        <div className="flex justify-end gap-2">
          {project?.running ? <><Button variant="outline" size="sm" className="hover:!bg-green-600 hover:!text-white [&:hover_svg]:!text-white" disabled={busy} onClick={() => { void run(async () => { await window.electronAPI.sourceProjectStop(); setProject(null) }) }}><Square />停止服务</Button><Button disabled={busy || !project.url} onClick={() => { onNavigate(project.url); onOpenChange(false) }}><ExternalLink />打开页面</Button></> : <Button disabled={busy || !root} onClick={() => { void run(async () => { const value = await window.electronAPI.sourceProjectStart({ root, config, mode, port: port ? Number(port) : undefined }); setProject(value); if (value?.url) { onNavigate(value.url); onOpenChange(false) } }) }}><Play />{busy ? "正在启动…" : "启动并打开"}</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
