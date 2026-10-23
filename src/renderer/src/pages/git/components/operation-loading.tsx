import { ArrowDownToLine, ArrowUpFromLine, GitBranch, LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

export type GitRemoteOperation = "push" | "pull" | "fetch"
const operations = {
  push: { title: "正在推送", description: "正在将本地提交发送到远端仓库", icon: ArrowUpFromLine },
  pull: { title: "正在拉取", description: "正在获取并整合远端更新", icon: ArrowDownToLine },
  fetch: { title: "正在抓取", description: "正在获取远端分支与提交信息", icon: RefreshCw }
}

export function GitOperationLoading({ operation, branch }: { operation: GitRemoteOperation; branch: string }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    setSeconds(0)
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [operation])
  const { title, description, icon: Icon } = operations[operation]
  return (
    <div className="git-operation-overlay absolute inset-x-0 bottom-0 top-12 z-50 flex items-center justify-center bg-black/[.04] px-6 backdrop-blur-[3px]">
      <section role="status" aria-live="polite" aria-atomic="true" className="git-operation-card w-full max-w-[320px] rounded-2xl border border-white/90 bg-white/95 p-6 shadow-[0_16px_60px_-16px_rgba(28,25,23,0.25)] dark:border-[#414b58] dark:bg-[#272e38]/95 dark:shadow-black/30">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"><Icon className="size-5" /></span>
          <LoaderCircle aria-hidden className="size-5 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-400" />
        </div>
        <h2 className="text-sm font-semibold text-stone-800 dark:text-slate-100">{title}…</h2>
        <p className="mt-1.5 text-xs leading-5 text-stone-500 dark:text-slate-400">{description}</p>
        {branch && <div className="mt-3 flex min-w-0 items-center gap-1.5 text-xs text-stone-600 dark:text-slate-300"><GitBranch aria-hidden className="size-3.5 shrink-0" /><span className="truncate">{branch}</span></div>}
        <div aria-hidden className="mt-5 h-1 overflow-hidden rounded-full bg-stone-100 dark:bg-slate-600/50"><div className="git-operation-progress h-full w-1/3 rounded-full bg-emerald-500 dark:bg-emerald-400" /></div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-stone-400 dark:text-slate-400"><span>{seconds >= 10 ? "远端响应较慢，请耐心等待" : "正在处理，请稍候"}</span><span className="shrink-0 tabular-nums">已等待 {seconds} 秒</span></div>
      </section>
    </div>
  )
}
