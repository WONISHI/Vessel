import { useMemo, useState } from "react"
import { Terminal, FileText, Info, AlertTriangle, XCircle, CheckCircle2, Trash2, type LucideIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type LogLevel = "log" | "info" | "warn" | "error"

interface LogEntry {
  id: number
  time: string
  level: LogLevel
  message: string
}

const INITIAL_LOGS: LogEntry[] = [
  { id: 1, time: "[14:32:05]", level: "log", message: "App initialized successfully" },
  { id: 2, time: "[14:32:06]", level: "info", message: "Workspace loaded: /Users/dev/Documents/notes" },
  { id: 3, time: "[14:32:08]", level: "log", message: "Rendered 42 files in workspace" },
  { id: 4, time: "[14:32:15]", level: "warn", message: "Deprecated API used: oldFormat() will be removed in v2.0" },
  { id: 5, time: "[14:32:20]", level: "log", message: '{"user": "alice", "action": "save", "file": "note.md"}' },
  {
    id: 6,
    time: "[14:32:25]",
    level: "error",
    message: "TypeError: Cannot read properties of undefined (reading 'map') at Editor.render (editor.tsx:142) at ReactComponent.render (react-dom.js:1234)"
  }
]

/** 日志行配色：普通/Info 无底色，Warn/Error 整条带浅色底 */
const levelStyle: Record<LogLevel, string> = {
  log: "text-stone-700",
  info: "text-teal-700",
  warn: "rounded-md bg-amber-50 text-amber-700",
  error: "rounded-md bg-red-50 text-red-700"
}

/* ============================================================
 * 顶部状态徽章
 * ========================================================== */

function StatusBadge({ tone, icon: Icon, text }: { tone: "red" | "green"; icon: LucideIcon; text: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", tone === "red" && "bg-red-50 text-red-600", tone === "green" && "bg-green-50 text-green-600")}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  )
}

/* ============================================================
 * 统计卡片
 * ========================================================== */

function StatCard({ label, value, icon: Icon, iconBg, iconColor, valueColor }: { label: string; value: number; icon: LucideIcon; iconBg: string; iconColor: string; valueColor: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e7e5e4] bg-white p-4">
      <div>
        <div className="text-[12px] font-medium text-stone-400">{label}</div>
        <div className={cn("mt-1.5 text-[26px] font-bold leading-none", valueColor)}>{value}</div>
      </div>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  )
}

/* ============================================================
 * 监听开关行
 * ========================================================== */

function MonitorSwitch({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  checked,
  onChange
}: {
  icon?: LucideIcon
  iconBg?: string
  iconColor?: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
            <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          </div>
        )}
        <span className="text-[13.5px] font-medium text-stone-700">{label}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  )
}

/* ============================================================
 * 控制台子页面
 * ========================================================== */

export default function ConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS)
  // 总开关默认开启；监听类型默认全部关闭（与设计稿一致）
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

  const toggleType = (level: LogLevel) => setTypes((prev) => ({ ...prev, [level]: !prev[level] }))

  return (
    <div className="flex h-full flex-col bg-[#faf9f7]">
      {/* 页面标题（高度固定 60px，参考 main-header） */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0efed] bg-white px-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-bold text-stone-900">控制台</h2>
          <span className="text-[12px] text-stone-400">Console 日志查看与监听控制</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            tone="red"
            icon={XCircle}
            text="1 Error"
          />
          <StatusBadge
            tone="green"
            icon={CheckCircle2}
            text="监听中"
          />
        </div>
      </div>

      {/* 内容区：统计卡片固定，下方双栏撑满剩余高度 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
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

        {/* 日志 + 监听控制（撑满剩余高度） */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] gap-4">
          {/* Console 日志 */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
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
            <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[12.5px] leading-relaxed [scrollbar-width:thin]">
              {logs.length === 0 && <div className="py-10 text-center font-sans text-[13px] italic text-stone-400">暂无日志</div>}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn("mb-0.5 flex items-start gap-3 px-2 py-1.5", levelStyle[log.level])}
                >
                  <span className="shrink-0 select-none text-stone-400">{log.time}</span>
                  <span className="whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 监听控制 */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e7e5e4] bg-white">
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
