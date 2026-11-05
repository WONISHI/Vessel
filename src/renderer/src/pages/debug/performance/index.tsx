import { ScrollArea } from "@/components/ui/scroll-area"
import { PageBackButton } from '@/pages/debug/components/page-back-button'
import { usePerformance, type PerformancePoint } from './use-performance'
import { Clock3, Monitor, Copy, Activity } from 'lucide-react'
import { useState } from 'react'
import './performance.css'

const processNames: Record<string, string> = { Browser: '主进程 (Main)', Tab: '渲染进程 (Renderer)', GPU: 'GPU 进程', Utility: 'Utility 进程', Zygote: 'Zygote 进程', 'Sandbox helper': '沙箱辅助进程' }
const size = (bytes: number | undefined) => bytes === undefined ? '—' : bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`
const signed = (bytes: number | null | undefined) => bytes == null ? '—' : `${bytes >= 0 ? '+' : '−'}${size(Math.abs(bytes))}`
function MetricCard({ label, value, unit, percent, cyan = false, hint }: { label: string; value: string; unit: string; percent: number; cyan?: boolean; hint: string }) {
  return <section className="performance-card" data-title={hint}><h3>{label}</h3><div className="performance-value">{value}<span>{unit}</span></div><div className="performance-track" aria-hidden="true"><div className={cyan ? 'performance-fill cyan' : 'performance-fill'} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></section>
}
function MemoryTrend({ points }: { points: PerformancePoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.total)) * 1.1
  const line = (key: 'total' | 'main' | 'renderer') => points.map((point, index) => `${index / Math.max(1, points.length - 1) * 600},${100 - point[key] / max * 95}`).join(' ')
  return <section className="performance-panel"><div className="performance-panel-heading"><h3><Activity size={15} />内存趋势</h3><span>最近 {points.length} 个采样 · 最多 120 个</span></div><div className="performance-trend"><svg viewBox="0 0 600 105" preserveAspectRatio="none" role="img" aria-label="应用总内存、渲染进程和主进程的内存趋势"><path d="M0 100H600 M0 50H600" stroke="var(--perf-rule)" fill="none" />{(['total', 'renderer', 'main'] as const).map((key, index) => <polyline key={key} points={line(key)} fill="none" stroke={['#0891b2', '#a78bfa', '#d97706'][index]} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}</svg><div className="performance-legend"><span>总量 {size(points.at(-1)?.total)}</span><span>渲染进程合计 {size(points.at(-1)?.renderer)}</span><span>主进程 {size(points.at(-1)?.main)}</span></div></div></section>
}
export default function PerformancePage() {
  const { snapshot, history, renderer, fps, error, visible } = usePerformance()
  const [copyStatus, setCopyStatus] = useState('')
  const cpu = snapshot?.cpuPercent
  const main = snapshot?.mainMemory
  const worker = main?.diagnosticsWorker
  const total = snapshot ? size(snapshot.memoryBytes).split(' ') : ['—', 'MiB']
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ snapshot, currentRenderer: renderer, history, note: 'working set may count shared memory more than once; URLs omit credentials and query values' }, null, 2)); setCopyStatus('已复制') }
    catch { setCopyStatus('复制失败') }
  }
  return <div className="performance-page">
    <header className="performance-header"><div className="flex items-center gap-2"><PageBackButton /><div><h2>性能监控</h2><p>进程来源 / 内存明细 / 历史趋势</p></div></div><div className="performance-actions"><button type="button" onClick={copy} disabled={!snapshot}><Copy size={13} />{copyStatus || '复制诊断'}</button><span className="performance-status" data-live={Boolean(snapshot && !error && visible)} role="status"><Clock3 size={13} />{error ? '采样失败' : !visible ? '已暂停' : snapshot ? 'Live' : '连接中'}</span></div></header>
    <ScrollArea className="performance-scroll" type="hover">
    <div className="performance-body">
      {error && <div role="alert" className="performance-error">无法读取性能数据：{error}（将自动重试）</div>}
      <div className="performance-metrics">
        <MetricCard label="CPU 使用率" value={cpu == null || error ? '—' : cpu.toFixed(1)} unit="%" percent={cpu ?? 0} hint="应用全部进程的平均 CPU 使用率之和；首轮等待建立基线，可能超过 100%。" />
        <MetricCard label="应用驻留内存合计" value={error ? '—' : total[0]} unit={total[1]} percent={snapshot ? snapshot.memoryBytes / snapshot.systemMemoryBytes * 100 : 0} cyan hint="进程 working set 合计，共享内存可能重复计算；不是 JS 堆总量。" />
        <MetricCard label="当前页面帧率" value={fps == null ? '—' : String(fps)} unit="FPS" percent={(fps ?? 0) / 60 * 100} hint="仅采样当前页面 requestAnimationFrame，不代表所有页面和输入操作的流畅度。" />
      </div>
      <p className="performance-note">驻留内存可能包含共享页与尚未归还系统的内存。低 CPU 不代表没有内存占用；进程增长也不能单独证明泄漏。</p>
      <MemoryTrend points={history} />
      <div className="performance-detail-grid">
        <section className="performance-panel"><div className="performance-panel-heading"><h3>主进程内存明细</h3><span>含 Node worker 所在进程</span></div><dl className="performance-facts"><div><dt>进程 RSS</dt><dd>{size(main?.rss)}</dd></div><div><dt>主线程 JS 堆 / 已分配</dt><dd>{size(main?.heapUsed)} / {size(main?.heapTotal)}</dd></div><div><dt>主线程外部内存（含 Buffer）</dt><dd>{size(main?.external)}</dd></div><div><dt>主线程 ArrayBuffer（外部内存子集）</dt><dd>{size(main?.arrayBuffers)}</dd></div><div><dt>主线程事件循环忙碌率</dt><dd>{main?.eventLoopUtilization == null ? '—' : `${(main.eventLoopUtilization * 100).toFixed(1)}%`}</dd></div><div><dt>TypeScript 检查 worker</dt><dd>{worker ? worker.running ? '运行中' : '未启动 / 已释放' : '—'}</dd></div><div><dt>检查中 / 等待中</dt><dd>{worker?.pending ?? 0} / {worker?.queued ?? 0}</dd></div><div><dt>检查队列估计文本量</dt><dd>{size(worker?.queuedBytes)}</dd></div><div><dt>Worker 最近 JS 堆采样</dt><dd>{size(worker?.heapUsed)}</dd></div>{worker?.idleReleaseAt && <div><dt>空闲释放时间</dt><dd>{new Date(worker.idleReleaseAt).toLocaleTimeString()}</dd></div>}</dl><p className="performance-note">RSS、JS 堆和外部内存有包含关系，不能相加。主线程堆不包含 worker 的堆；worker 最近采样不等于当前存活对象大小。</p></section>
        <section className="performance-panel"><div className="performance-panel-heading"><h3>当前渲染进程与资源</h3><span>其他渲染进程见下方来源</span></div><dl className="performance-facts"><div><dt>当前 JS 堆（浏览器估计）</dt><dd>{size(renderer?.heapUsed)}</dd></div><div><dt>DOM 元素</dt><dd>{renderer?.domNodes ?? '—'}</dd></div><div><dt>Markdown / 代码编辑器</dt><dd>{renderer?.editors ?? 0} / {renderer?.codeEditors ?? 0}</dd></div><div><dt>挂载文档 / 隐藏文档</dt><dd>{renderer?.documentTabs ?? 0} / {renderer?.hiddenTabs ?? 0}</dd></div><div><dt>iframe / 浏览器 webview</dt><dd>{renderer?.iframes ?? 0} / {renderer?.webviews ?? 0}</dd></div><div><dt>当前监控期间长任务 / 最长</dt><dd>{renderer?.longTasks ?? 0} / {Math.round(renderer?.longestTaskMs ?? 0)} ms</dd></div><div><dt>应用窗口 / WebContents / frames</dt><dd>{snapshot?.resources ? `${snapshot.resources.windows} / ${snapshot.resources.webContents} / ${snapshot.resources.frames}` : '—'}</dd></div></dl><p className="performance-note">长任务仅统计此渲染进程中超过 50 ms 的任务。跨进程页面的 DOM 与堆未计入这里。来源中的宿主窗口可见，不代表子页面在前台。</p></section>
      </div>
      <section className="performance-processes"><div className="performance-process-heading"><h3><Monitor size={15} />进程与页面来源</h3><span>{snapshot?.processes.length ?? 0} 个进程 · 按内存排序</span></div><div className="performance-process-scroll"><table aria-label="应用进程性能"><thead><tr><th>进程 / 页面 / 所属窗口</th><th>CPU</th><th>驻留内存</th><th>上次采样变化</th></tr></thead><tbody>{[...(snapshot?.processes ?? [])].sort((a, b) => b.memoryBytes - a.memoryBytes).map((process) => <tr key={`${process.pid}:${process.creationTime}`}><th scope="row"><div>{processNames[process.type] ?? process.type}<span className="performance-process-name">{process.name}</span><span className="performance-pid">PID {process.pid}</span></div>{process.sources?.length ? <details open><summary>{process.sources.length} 个页面 / frame 来源</summary><div className="performance-sources">{process.sources.map((source) => <div className="performance-source" key={`${source.webContentsId}:${source.frameId}`}><div><b>{source.kind}</b><span>{source.visible === true ? '宿主窗口可见' : source.visible === false ? '宿主窗口隐藏' : '可见性未确认'}</span></div><p>{source.title || '无页面标题'}{source.windowTitle && ` · 窗口：${source.windowTitle}`}</p><code>{source.url || '页面地址不可用'}</code><small>WebContents {source.webContentsId} · Frame {source.frameId}</small></div>)}</div></details> : process.type === 'Tab' ? <p className="performance-note">暂未关联页面：可能正在创建、退出或已脱离 frame。</p> : null}</th><td className="performance-cpu" data-busy={(process.cpuPercent ?? 0) >= 50}>{error || process.cpuPercent == null ? '—' : `${process.cpuPercent.toFixed(1)}%`}</td><td className="performance-memory">{size(process.memoryBytes)}<small>历史峰值 {size(process.peakMemoryBytes)}</small></td><td className="performance-delta" data-growing={(process.deltaBytes ?? 0) > 0}>{signed(process.deltaBytes)}</td></tr>)}</tbody></table>{!snapshot && <div className="performance-empty">正在获取进程数据…</div>}</div></section>
    </div>
    </ScrollArea>
  </div>
}
