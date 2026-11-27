import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TransitPanel } from '@/components/transit/panel/components/transit-panel'

vi.mock('@/components/transit/state', () => ({
  useTransit: () => ({ selected: 'sheet', items: [{ id: 'sheet', kind: 'file', root: '/vault', content: '/vault/sheet.xlsx', title: 'sheet.xlsx' }] }),
  selectTransit: vi.fn(), addTransit: vi.fn(), addTransitFile: vi.fn()
}))
vi.mock('@/components/transit/panel/components/transit-status', () => ({ TransitStatus: () => null }))
vi.mock('@/components/transit/text-preview', () => ({ TransitTextPreview: () => null }))
vi.mock('@/components/transit/panel/components/web-preview', () => ({ WebPreview: () => null }))
vi.mock('@/components/transit/file-preview', async () => {
  const { OfficePreview } = await import('@/components/transit/file-preview/components/office-preview')
  const file = { kind: 'office' as const, name: 'sheet.xlsx', bytes: new Uint8Array([1]) }
  return { FilePreview: () => <OfficePreview file={file} /> }
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('expands and restores the actual Office preview without creating a new iframe or opening Office again', async () => {
  const openOffice = vi.fn().mockResolvedValue('http://127.0.0.1:35679/')
  window.electronAPI = { openOffice } as unknown as typeof window.electronAPI
  render(<TransitPanel />)
  const frame = await screen.findByLabelText('预览 sheet.xlsx') as HTMLIFrameElement
  const guest = frame.contentWindow!, src = frame.src
  const initialize = vi.spyOn(guest, 'postMessage')
  fireEvent(window, new MessageEvent('message', { source: guest, origin: new URL(src).origin, data: { type: 'office:ready' } }))
  expect(initialize).toHaveBeenCalledOnce()
  const observer = new MutationObserver(() => {})
  observer.observe(document.body, { childList: true, subtree: true })
  for (let round = 0; round < 3; round++) {
    fireEvent.click(screen.getByRole('button', { name: '展开' }))
    fireEvent.click(screen.getByRole('button', { name: '还原' }))
    expect(screen.getByLabelText('预览 sheet.xlsx')).toBe(frame)
    expect(frame.contentWindow).toBe(guest)
    expect(frame.src).toBe(src)
    expect(observer.takeRecords().some(record => [...record.removedNodes].some(node => node === frame || node.contains(frame)))).toBe(false)
  }
  expect(openOffice).toHaveBeenCalledOnce()
  expect(initialize).toHaveBeenCalledOnce()
  observer.disconnect()
})
