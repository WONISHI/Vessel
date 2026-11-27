import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from '@vessel/react-router'
import { ReadyRouter } from '@/components/app/ready-router'

afterEach(cleanup)

it('retains boot feedback while initial remote navigation is pending, then reveals the page', async () => {
  let finish!: () => void
  const pending = new Promise<void>(resolve => { finish = resolve })
  const router = createRouter({ history: createMemoryHistory(['/']), routes: [{ path: '/', component: () => <main>工作区已就绪</main> }] })
  router.beforeEach(async () => { await pending; return true })
  render(<ReadyRouter router={router} fallback={<div role="status">正在准备工作区…</div>} />)
  expect(screen.getByRole('status').textContent).toBe('正在准备工作区…')
  expect(screen.queryByText('工作区已就绪')).toBeNull()
  await act(async () => { finish(); await router.isReady() })
  await waitFor(() => expect(screen.getByText('工作区已就绪')).toBeTruthy())
  expect(screen.queryByRole('status')).toBeNull()
})
