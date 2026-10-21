export interface PerformanceProcess {
  pid: number
  creationTime: number
  type: string
  name: string
  cpuPercent: number | null
  memoryBytes: number
}

export interface PerformanceSnapshot {
  sampledAt: number
  processes: PerformanceProcess[]
  cpuPercent: number | null
  memoryBytes: number
  systemMemoryBytes: number
}
