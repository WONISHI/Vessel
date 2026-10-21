import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageBackButton } from "@/pages/debug/components/page-back-button"
import { INITIAL_LOGS, LogEntry, LogLevel, levelStyle } from "@/pages/debug/console/components/devtools-console-shared"
import { MonitorSwitch } from "@/pages/debug/console/components/monitor-switch"
import { StatCard } from "@/pages/debug/console/components/stat-card"
import { StatusBadge } from "@/pages/debug/console/components/status-badge"
import { AlertTriangle, CheckCircle2, FileText, Info, Terminal, Trash2, XCircle } from "lucide-react"
import { useMemo, useState } from "react"

/** Renders the console page component. */
export function ConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS)
  // 保留现有监听开关状态。
  const [master, setMaster] = useState(true)
  const [types, setTypes] = useState<Record<LogLevel, boolean>>({
    log: false,
    info: false,
    warn: false,
    error: false
  })

  const counts = useMemo(
    () => ({
      total: logs.length,
      log: logs.filter((l) => l.level === "log").length,
      warn: logs.filter((l) => l.level === "warn").length,
      error: logs.filter((l) => l.level === "error").length
    }),
    [logs]
  )

  /** Toggles type. */
  const toggleType = (level: LogLevel) => setTypes((prev) => ({ ...prev, [level]: !prev[level] }))

  return (
    <div className="dev-console-page flex h-full flex-col bg-[#faf9f7]">
      {/* 页面标题（高度固定 60px，参考 main-header） */}
      <div className="console-page-header flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4">
        <div className="flex items-center gap-2">
          <PageBackButton />
          <div className="flex flex-col items-start gap-0.5">
            <h2 className="text-[16px] font-bold text-stone-900">控制台</h2>
            <span className="text-[12px] text-stone-400">Console 日志查看与监听控制</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            tone="red"
            icon={XCircle}
            text={`${counts.error} Error`}
          />
          <StatusBadge
            tone="green"
            icon={CheckCircle2}
            text={master ? "监听中" : "已暂停"}
          />
        </div>
      </div>

      {/* 内容区：统计卡片与等宽双栏 */}
      <div className="diagnostics-console-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* 统计卡片 */}
        <div className="grid shrink-0 grid-cols-4 gap-4">
          <StatCard
            label="总日志"
            value={counts.total}
            icon={Terminal}
            iconBg="bg-stone-100"
            iconColor="text-stone-500"
            valueColor="text-stone-900"
          />
          <StatCard
            label="Log"
            value={counts.log}
            icon={FileText}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
            valueColor="text-teal-600"
          />
          <StatCard
            label="Warn"
            value={counts.warn}
            icon={AlertTriangle}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            valueColor="text-amber-600"
          />
          <StatCard
            label="Error"
            value={counts.error}
            icon={XCircle}
            iconBg="bg-red-50"
            iconColor="text-red-600"
            valueColor="text-red-600"
          />
        </div>

        {/* 日志 + 监听控制 */}
        <div className="diagnostics-console-grid grid min-h-0 grid-cols-2 gap-3">
          {/* Console 日志 */}
          <div className="console-panel flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-[#f0efed] px-4 py-3">
              <div className="flex items-center gap-2 text-[14px] font-bold text-stone-800">
                <Terminal className="h-4 w-4 text-stone-500" />
                Console 日志
                <span className="rounded-md border border-[#e7e5e4] bg-[#faf9f7] px-2 py-0.5 text-[12px] font-medium text-stone-500">{logs.length} 条</span>
              </div>
              <button
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium text-stone-500 transition-colors hover:bg-[#faf9f7] hover:text-stone-700"
                onClick={() => setLogs([])}
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空
              </button>
            </div>
            <ScrollArea className="min-h-0 flex-1 p-3 font-mono text-[12.5px] leading-relaxed">
              {logs.length === 0 && <div className="py-10 text-center font-sans text-[13px] italic text-stone-400">暂无日志</div>}
              {logs.map((log) => (
                <div
                  key={log.id}
                  data-log-level={log.level}
                  className={cn("mb-0.5 flex items-start gap-3 px-2 py-1.5", levelStyle[log.level])}
                >
                  <span className="shrink-0 select-none text-stone-400">{log.time}</span>
                  <span className="whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* 监听控制 */}
          <div className="console-panel flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#f0efed] px-4 py-3 text-[14px] font-bold text-stone-800">
              <CheckCircle2 className="h-4 w-4 text-stone-500" />
              监听控制
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 [scrollbar-width:thin]">
              {/* 总开关 */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-[13.5px] font-medium text-stone-700">总开关</div>
                  <div className="mt-0.5 text-[12px] text-stone-400">拦截 console 输出</div>
                </div>
                <Switch
                  aria-label="总开关"
                  checked={master}
                  onCheckedChange={setMaster}
                />
              </div>

              <div className="my-1 border-t border-[#f0efed]" />

              <div className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-stone-400">监听类型</div>

              <MonitorSwitch
                icon={FileText}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
                label="Log"
                checked={types.log}
                onChange={() => toggleType("log")}
              />
              <MonitorSwitch
                icon={Info}
                iconBg="bg-cyan-50"
                iconColor="text-cyan-600"
                label="Info"
                checked={types.info}
                onChange={() => toggleType("info")}
              />
              <MonitorSwitch
                icon={AlertTriangle}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Warn"
                checked={types.warn}
                onChange={() => toggleType("warn")}
              />
              <MonitorSwitch
                icon={XCircle}
                iconBg="bg-red-50"
                iconColor="text-red-600"
                label="Error"
                checked={types.error}
                onChange={() => toggleType("error")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
