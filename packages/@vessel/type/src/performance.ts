export interface PerformanceSource {
  webContentsId: number
  frameId: number
  kind: string
  title: string
  url: string
  windowTitle: string
  visible: boolean | null
}
export interface PerformanceProcess {
  pid: number
  creationTime: number
  type: string
  name: string
  cpuPercent: number | null
  memoryBytes: number
  peakMemoryBytes?: number
  deltaBytes?: number | null
  sources?: PerformanceSource[]
}
export interface MainMemoryDiagnostic {
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  eventLoopUtilization: number | null
  diagnosticsWorker: { running: boolean; pending: number; queued: number; queuedBytes: number; idleReleaseAt?: number; heapUsed?: number; sampledAt?: number }
}
export interface PerformanceSnapshot {
  sampledAt: number
  processes: PerformanceProcess[]
  cpuPercent: number | null
  memoryBytes: number
  systemMemoryBytes: number
  mainMemory?: MainMemoryDiagnostic
  resources?: { windows: number; webContents: number; frames: number }
}
