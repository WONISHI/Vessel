import type { ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FeaturePageOverlay } from '@/components/layout/feature-page-overlay'

const pending = vi.hoisted(() => {
  let finishShell!: () => void, finishTool!: () => void
  const shell = new Promise<void>(resolve => { finishShell = resolve })
  const tool = new Promise<void>(resolve => { finishTool = resolve })
  return { shell, tool, finishShell, finishTool }
})
vi.mock('@/lib/page-transition', () => ({ rememberPageContent: () => () => {} }))
vi.mock('@/pages/debug/components/dev-tools-index', async () => {
  await pending.shell
  return { DevToolsIndex: ({ children }: { children: ReactNode }) => <div><nav>开发工具导航</nav>{children}</div> }
})
vi.mock('@/pages/debug/json', async () => {
  await pending.tool
  return { JsonTool: () => <main>JSON 工具已就绪</main> }
})
afterEach(cleanup)

it('uses skeletons for both titlebar-overlay loading stages and retains the tools navigation', async () => {
  render(<FeaturePageOverlay feature="devtools" tool="json" onToolChange={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('status').textContent).toBe('')
  expect(screen.queryByText('正在加载…')).toBeNull()
  await act(async () => { pending.finishShell(); await pending.shell })
  await screen.findByText('开发工具导航')
  expect(screen.getByRole('status').textContent).toBe('')
  expect(screen.queryByText('正在加载工具…')).toBeNull()
  await act(async () => { pending.finishTool(); await pending.tool })
  await waitFor(() => expect(screen.getByText('JSON 工具已就绪')).toBeTruthy())
  expect(screen.getByText('开发工具导航')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
})
