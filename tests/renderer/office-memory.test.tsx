import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/hooks/use-dark-appearance', () => ({ useDarkAppearance: () => false }))
vi.mock('@/features/office/components/pdf-pane', () => ({ PdfPane: ({ doc }: any) => <div data-testid="pdf-preview">{doc.name}</div> }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null, toast: {} }))
import { Office } from '@/features/office/components/office'
afterEach(() => { cleanup(); vi.useRealTimers() })
function external(name: string) {
  act(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent, data: { type: 'office:external', document: { name, token: name, bytes: new Uint8Array([1]) } } })))
}
function state(frame: HTMLIFrameElement, dirty: boolean) {
  act(() => window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: location.origin, data: { type: 'office:state', dirty, status: '本地编辑' } })))
}
it('unloads inactive PDF instances but preserves editable Office runtime state', () => {
  render(<Office />)
  external('a.docx')
  state(screen.getByLabelText('a.docx') as HTMLIFrameElement, false)
  external('b.pdf')
  expect(screen.getByLabelText('a.docx')).toBeTruthy()
  expect(screen.getByTestId('pdf-preview')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'a.docx' }))
  expect(screen.queryByTestId('pdf-preview')).toBeNull()
  state(screen.getByLabelText('a.docx') as HTMLIFrameElement, true)
  external('c.pdf')
  expect(screen.getByLabelText('a.docx')).toBeTruthy()
  expect(screen.getByRole('tab', { name: /a.docx/ }).textContent).toContain('•')
})
it('suspends background PDF previews and recreates them on return', () => {
  vi.useFakeTimers()
  render(<Office />)
  external('clean.pdf')
  act(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent, data: { type: 'office:visibility', visible: false } })))
  act(() => vi.advanceTimersByTime(30_000))
  expect(screen.queryByTestId('pdf-preview')).toBeNull()
  expect(screen.getByRole('tab', { name: 'clean.pdf' })).toBeTruthy()
  act(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent, data: { type: 'office:visibility', visible: true } })))
  expect(screen.getByTestId('pdf-preview')).toBeTruthy()
})
