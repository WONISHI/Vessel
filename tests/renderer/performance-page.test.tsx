import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/pages/debug/components/page-back-button', () => ({ PageBackButton: () => <button>返回</button> }))
vi.mock('@/pages/debug/performance/use-performance', () => ({ usePerformance: () => ({ fps: 120, visible: true, error: '', history: [{ time: 1, total: 1e9, main: 3e8, renderer: 7e8 }], renderer: { heapUsed: 2e8, domNodes: 99, editors: 3, codeEditors: 1, documentTabs: 3, hiddenTabs: 2, iframes: 1, webviews: 1, longTasks: 2, longestTaskMs: 70 }, snapshot: { sampledAt: 1, cpuPercent: 3, memoryBytes: 1e9, systemMemoryBytes: 16e9, resources: { windows: 1, webContents: 2, frames: 3 }, mainMemory: { rss: 3e8, heapUsed: 4e7, heapTotal: 6e7, external: 5e6, arrayBuffers: 2e6, eventLoopUtilization: .01, diagnosticsWorker: { running: true, pending: 0, queued: 0, queuedBytes: 0, heapUsed: 1e8 } }, processes: [{ pid: 123, creationTime: 1, type: 'Tab', name: '', memoryBytes: 7e8, deltaBytes: 2e6, peakMemoryBytes: 8e8, cpuPercent: 2, sources: [{ webContentsId: 4, frameId: 8, kind: 'Office 页面', title: '简历', url: 'http://127.0.0.1/office.html', windowTitle: 'Vessel', visible: true }] }] } }) }))
import PerformancePage from '@/pages/debug/performance'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows process origins, heap breakdown and bounded trend, and copies diagnosis data', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  render(<PerformancePage />)
  expect(screen.getByText('内存趋势').closest('[data-radix-scroll-area-viewport]')).not.toBeNull()
  expect(screen.getByText('Office 页面')).toBeTruthy()
  expect(screen.getByText('PID 123')).toBeTruthy()
  expect(screen.getByText('http://127.0.0.1/office.html')).toBeTruthy()
  expect(screen.getByText('主线程 JS 堆 / 已分配')).toBeTruthy()
  expect(screen.getByText('Worker 最近 JS 堆采样')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(screen.getByText('已复制')).toBeTruthy())
  const copied = JSON.parse(writeText.mock.calls[0][0])
  expect(copied.snapshot.processes[0].pid).toBe(123)
  expect(copied.history).toHaveLength(1)
})
