import type { PropsWithChildren } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HistorySheet } from '@/pages/browser/components/history-sheet/components/history-sheet'

vi.mock('@/features/layout/use-dialog-layout', () => ({ useDialogLayout: () => ({ sheetStyle: {} }) }))
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: PropsWithChildren) => <div>{children}</div> }))
afterEach(cleanup)

const entry = { id: 1, title: 'Example', url: 'https://example.com/page', visitedAt: Date.now(), bookmarked: true }

it.each(['icon', 'title', 'url', 'time', 'bookmark'])('opens a history record by clicking its %s', target => {
  const navigate = vi.fn(), close = vi.fn()
  render(<HistorySheet open onOpenChange={close} entries={[entry]} error="" onDelete={vi.fn()} onNavigate={navigate} />)
  const button = screen.getByRole('button', { name: '打开记录 Example' })
  const element = target === 'icon' ? button.querySelector('img')!
    : target === 'title' ? screen.getByText('Example')
    : target === 'url' ? screen.getByText('example.com/page')
    : target === 'time' ? button.querySelector('time')!
    : screen.getByLabelText('已收藏')
  fireEvent.click(element)
  expect(navigate).toHaveBeenCalledExactlyOnceWith(entry.url)
  expect(close).toHaveBeenCalledExactlyOnceWith(false)
})

it('deletes a record without navigating or closing the history sheet', () => {
  const navigate = vi.fn(), close = vi.fn(), remove = vi.fn()
  render(<HistorySheet open onOpenChange={close} entries={[entry]} error="" onDelete={remove} onNavigate={navigate} />)
  fireEvent.click(screen.getByRole('button', { name: '删除记录 Example', hidden: true }))
  expect(remove).toHaveBeenCalledExactlyOnceWith(entry.id)
  expect(navigate).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
})
