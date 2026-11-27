import { act, cleanup, render, screen } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import { afterEach, expect, it } from 'vitest'
import { RouteLoading } from '@/components/ui/route-loading'
import { PageSkeleton } from '@/components/ui/page-skeleton'

afterEach(cleanup)

it('keeps the tools navigation visible and shows skeletons without visible loading text until the page is ready', async () => {
  let finish!: (value: { default: () => React.JSX.Element }) => void
  const pending = new Promise<{ default: () => React.JSX.Element }>(resolve => { finish = resolve })
  const Page = lazy(() => pending)
  const view = render(<div><nav>开发工具侧栏</nav><Suspense fallback={<RouteLoading skeleton />}><Page /></Suspense></div>)
  expect(screen.getByText('开发工具侧栏')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('')
  expect(view.container.querySelector('[data-page-transition-loading]')).toBeTruthy()
  await act(async () => { finish({ default: () => <main>JSON 工具</main> }); await pending })
  expect(screen.getByText('JSON 工具')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  expect(view.container.querySelector('[data-page-transition-loading]')).toBeNull()
})

it('provides an editor-only skeleton without the default Monaco loading text', () => {
  render(<PageSkeleton editorOnly />)
  expect(screen.getByRole('status').textContent).toBe('')
  expect(screen.queryByText(/Loading|加载中/)).toBeNull()
})
