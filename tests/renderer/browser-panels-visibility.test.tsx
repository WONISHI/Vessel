import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BrowserExtensions } from '@/pages/browser/components/extensions/components/browser-extensions'
import { BrowserMore } from '@/pages/browser/components/tools/components/browser-more'
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({children}: any) => <div>{children}</div> }))
vi.mock('@/components/ui/sheet', () => ({ Sheet: ({open,children}: any) => open ? <div>{children}</div> : null, SheetContent: ({children}: any) => <section>{children}</section>, SheetHeader: ({children}: any) => <header>{children}</header>, SheetTitle: ({children}: any) => <h2>{children}</h2>, SheetDescription: ({children}: any) => <p>{children}</p> }))
vi.mock('@/components/ui/dropdown-menu', () => ({ DropdownMenu: ({children}: any) => <div>{children}</div>, DropdownMenuTrigger: ({children}: any) => <div>{children}</div>, DropdownMenuContent: ({children}: any) => <div>{children}</div>, DropdownMenuItem: ({children,onSelect}: any) => <button onClick={onSelect}>{children}</button>, DropdownMenuLabel: ({children}: any) => <div>{children}</div>, DropdownMenuSeparator: () => null, DropdownMenuShortcut: ({children}: any) => <span>{children}</span> }))
it('切离页面关闭管理与历史侧栏，返回后不重新打开', async () => {
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  const close = vi.fn(async () => {})
  window.electronAPI = { onWebStoreInstall: () => () => {}, listBrowserExtensions: async () => [], onBrowserExtensionClosed: () => () => {}, closeBrowserExtension: close, listBrowserHistory: async () => [] } as any
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const render = (visible: boolean) => <><BrowserExtensions visible={visible}/><BrowserMore visible={visible} zoomFactor={1} zoom={()=>{}} onFind={()=>{}} onNavigate={()=>{}} guest={()=>undefined} deviceMode={false} onDevice={()=>{}}/></>
  await act(async () => root.render(render(true)))
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="管理浏览器扩展"]')!.click())
  await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '历史记录')!.click())
  expect(container.textContent).toContain('浏览器扩展')
  expect(container.textContent).toContain('浏览历史')
  expect(container.querySelector('kbd')).toBeNull()
  await act(async () => root.render(render(false)))
  expect(container.querySelector('h2')).toBeNull()
  expect(close).toHaveBeenCalled()
  await act(async () => root.render(render(true)))
  expect(container.querySelector('h2')).toBeNull()
  await act(async () => root.unmount()); container.remove()
})
