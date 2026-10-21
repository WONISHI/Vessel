import { PageBackButton } from "@/pages/debug/components/page-back-button"
import { Clock3, Database, Globe, Monitor, RectangleHorizontal, Shield, Square, Wifi, type LucideIcon } from "lucide-react"
import { useSystemInfo } from "./use-system-info"
import "../performance/performance.css"
import "./system-info.css"

const platformNames: Record<string, string> = { darwin: "macOS", win32: "Windows", linux: "Linux" }

function formatStorage(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const unit = bytes >= 1024 ** 3 ? "GB" : bytes >= 1024 ** 2 ? "MB" : "KB"
  const divisor = unit === "GB" ? 1024 ** 3 : unit === "MB" ? 1024 ** 2 : 1024
  return `${(bytes / divisor).toFixed(2)} ${unit}`
}

function InfoRow({ icon: Icon, label, value, positive = false, hint }: { icon: LucideIcon; label: string; value: string; positive?: boolean; hint?: string }) {
  return <div className="system-info-row" data-title={hint}><dt><Icon aria-hidden="true" className="size-3.5" />{label}</dt><dd data-positive={positive}>{value}</dd></div>
}

export default function SystemInfoPage() {
  const { info, windowInfo, error } = useSystemInfo()
  const available = info && !error ? info : null
  return (
    <div className="performance-page system-info-page">
      <header className="performance-header">
        <div className="flex items-center gap-2"><PageBackButton /><div><h2>系统信息</h2><p>平台 / 分辨率 / 网络状态</p></div></div>
      </header>
      <div className="performance-body">
        {error && <div className="performance-error" role="alert">无法读取系统信息：{error}（将自动重试）</div>}
        <section className="system-info-panel" aria-label="系统信息">
          <h3><Monitor className="size-4" />系统信息</h3>
          <div className="system-info-columns">
            <dl>
              <InfoRow icon={RectangleHorizontal} label="平台" value={available ? `${available.platform} (${platformNames[available.platform] ?? available.platform})` : "—"} hint={available ? `${available.arch} · ${available.osRelease}` : undefined} />
              <InfoRow icon={Globe} label="语言" value={windowInfo.language || available?.locale || "—"} hint={available ? `应用语言：${available.locale}` : undefined} />
              <InfoRow icon={Shield} label="Electron" value={available ? `v${available.electronVersion}` : "—"} positive />
              <InfoRow icon={Database} label="存储占用" value={available ? formatStorage(available.storageBytes) : "—"} hint="应用 SQLite 数据库与 WAL、SHM 文件占用；每 5 秒更新，不包含工作区文件和浏览器缓存。" />
            </dl>
            <dl>
              <InfoRow icon={Monitor} label="屏幕分辨率" value={available ? `${available.display.width} × ${available.display.height}` : "—"} hint="当前窗口所在屏幕的逻辑尺寸 × 屏幕缩放系数，单位为像素；每 5 秒更新。" />
              <InfoRow icon={Square} label="窗口尺寸" value={`${windowInfo.width} × ${windowInfo.height}`} hint="当前页面可视区域尺寸，单位为 CSS 像素。" />
              <InfoRow icon={Clock3} label="像素比" value={`${Number(windowInfo.pixelRatio.toFixed(2))}x`} hint="当前页面 devicePixelRatio，随屏幕缩放及页面缩放变化。" />
              <InfoRow icon={Wifi} label="网络状态" value={windowInfo.online ? "在线" : "离线"} positive={windowInfo.online} hint="基于系统网络连接状态，不代表外部网站一定可访问。" />
            </dl>
          </div>
        </section>
        {!info && !error && <span className="system-info-loading" role="status">正在读取系统信息…</span>}
      </div>
    </div>
  )
}
