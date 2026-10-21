import { PageBackButton } from "@/pages/debug/components/page-back-button"
import { usePerformance } from "./use-performance"
import { Clock3, Monitor } from "lucide-react"
import "./performance.css"

const processNames: Record<string, string> = { Browser: "主进程 (Main)", Tab: "渲染进程 (Renderer)", GPU: "GPU 进程", Utility: "Utility 进程", Zygote: "Zygote 进程", "Sandbox helper": "沙箱辅助进程" }

function memory(bytes: number) {
  return bytes >= 1024 ** 3 ? { value: (bytes / 1024 ** 3).toFixed(1), unit: "GB" } : { value: Math.round(bytes / 1024 ** 2).toString(), unit: "MB" }
}

function MetricCard({ label, value, unit, percent, cyan = false, hint }: { label: string; value: string; unit: string; percent: number; cyan?: boolean; hint: string }) {
  return (
    <section className="performance-card" data-title={hint}>
      <h3>{label}</h3>
      <div className="performance-value">{value}<span>{unit}</span></div>
      <div className="performance-track" aria-hidden="true"><div className={cyan ? "performance-fill cyan" : "performance-fill"} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
    </section>
  )
}

export default function PerformancePage() {
  const { snapshot, fps, error, visible } = usePerformance()
  const ram = snapshot ? memory(snapshot.memoryBytes) : null
  const cpu = snapshot?.cpuPercent
  return (
    <div className="performance-page">
      <header className="performance-header">
        <div className="flex items-center gap-2"><PageBackButton /><div><h2>性能监控</h2><p>CPU / 内存 / 帧率实时监控</p></div></div>
        <span className="performance-status" data-live={Boolean(snapshot && !error && visible)} role="status"><Clock3 className="size-3.5" />{error ? "采样失败" : !visible ? "已暂停" : snapshot ? "Live" : "连接中"}</span>
      </header>
      <div className="performance-body">
        {error && <div role="alert" className="performance-error">无法读取性能数据：{error}（将自动重试）</div>}
        <div className="performance-metrics">
          <MetricCard label="CPU 使用率" value={cpu == null || error ? "—" : cpu.toFixed(1)} unit="%" percent={error ? 0 : cpu ?? 0} hint="应用全部进程的 CPU 使用率之和，首轮采样等待建立基线；可能超过 100%。" />
          <MetricCard label="内存使用" value={error ? "—" : ram?.value ?? "—"} unit={ram?.unit ?? "MB"} percent={!error && snapshot ? snapshot.memoryBytes / snapshot.systemMemoryBytes * 100 : 0} cyan hint="所有应用进程的驻留内存之和（共享内存可能重复计入）；进度条为占系统物理内存的比例。" />
          <MetricCard label="渲染帧率" value={fps == null ? "—" : String(fps)} unit="FPS" percent={(fps ?? 0) / 60 * 100} hint="当前监控页面 requestAnimationFrame 回调采样，进度条以 60 FPS 为参考；高刷新率屏幕可超过 60 FPS。" />
        </div>
        <section className="performance-processes">
          <div className="performance-process-heading"><h3><Monitor className="size-4" />进程列表</h3><span>{snapshot?.processes.length ?? 0} 个进程</span></div>
          <div className="performance-process-scroll">
            <table aria-label="应用进程性能"><thead className="sr-only"><tr><th>进程</th><th>CPU 使用率</th><th>驻留内存</th></tr></thead><tbody>
              {snapshot?.processes.map((process) => <tr key={`${process.pid}:${process.creationTime}`}>
                <th scope="row">{processNames[process.type] ?? process.type}{process.name && <span className="performance-process-name">{process.name}</span>}<span className="performance-pid">PID {process.pid}</span></th>
                <td className="performance-cpu" data-busy={(process.cpuPercent ?? 0) >= 50}>{error || process.cpuPercent === null ? "—" : `${process.cpuPercent.toFixed(1)}%`}</td>
                <td className="performance-memory">{error ? "—" : `${Math.round(process.memoryBytes / 1024 ** 2)} MB`}</td>
              </tr>)}
            </tbody></table>
            {!snapshot && <div className="performance-empty">{error ? "性能数据暂不可用" : "正在获取进程数据…"}</div>}
            {snapshot?.processes.length === 0 && <div className="performance-empty">暂无进程数据</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
