import { createPerformanceSampler } from "@main/modules/welcome/performance"
import type { ProcessMetric } from "electron"
import { expect, it, vi } from "vitest"

it("warms CPU samples, converts KB, shares cached reads and resets reused PIDs", () => {
  let time = 1000
  const metrics: ProcessMetric[] = [{ pid: 10, creationTime: 1, type: "Browser", cpu: { percentCPUUsage: 12.5, idleWakeupsPerSecond: 0 }, memory: { workingSetSize: 2048, peakWorkingSetSize: 4096 } }]
  const read = vi.fn(() => metrics)
  const sample = createPerformanceSampler(read, () => 8 * 1024 ** 3, () => time)
  expect(sample()).toMatchObject({ cpuPercent: null, memoryBytes: 2 * 1024 ** 2, systemMemoryBytes: 8 * 1024 ** 3 })
  time += 500
  sample()
  expect(read).toHaveBeenCalledTimes(1)
  time += 500
  expect(sample().cpuPercent).toBe(12.5)
  metrics[0].creationTime = 2
  time += 1000
  expect(sample().processes[0].cpuPercent).toBeNull()
  metrics.pop()
  time += 1000
  expect(sample()).toMatchObject({ processes: [], memoryBytes: 0, cpuPercent: 0 })
})
