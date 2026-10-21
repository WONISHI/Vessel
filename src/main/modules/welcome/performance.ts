import type { PerformanceSnapshot } from "@vessel/type"
import type { ProcessMetric } from "electron"

/** Cache reads so multiple windows do not reset each other's CPU sampling interval. */
export function createPerformanceSampler(readMetrics: () => ProcessMetric[], totalMemory: () => number, now = Date.now) {
  let snapshot: PerformanceSnapshot | null = null
  let previousProcesses = new Set<string>()
  return (): PerformanceSnapshot => {
    const sampledAt = now()
    if (snapshot && sampledAt - snapshot.sampledAt < 900) return snapshot
    const metrics = readMetrics()
    const processes = metrics.map((metric) => ({
      pid: metric.pid,
      creationTime: metric.creationTime,
      type: metric.type,
      name: metric.name || metric.serviceName || "",
      cpuPercent: previousProcesses.has(`${metric.pid}:${metric.creationTime}`) ? Math.max(0, metric.cpu.percentCPUUsage) : null,
      memoryBytes: Math.max(0, metric.memory.workingSetSize) * 1024
    }))
    previousProcesses = new Set(processes.map((item) => `${item.pid}:${item.creationTime}`))
    snapshot = {
      sampledAt,
      processes,
      cpuPercent: processes.some((item) => item.cpuPercent === null) ? null : processes.reduce((sum, item) => sum + (item.cpuPercent ?? 0), 0),
      memoryBytes: processes.reduce((sum, item) => sum + item.memoryBytes, 0),
      systemMemoryBytes: totalMemory()
    }
    return snapshot
  }
}
