import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BookmarkBar } from '@/pages/browser/components/bookmark-bar'
import { browserTabAction } from '@/pages/browser/tab-state'
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('opens a bookmarked URL in a new tab without replacing the current page', () => {
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(1000)
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
 const navigate=vi.fn(), action=vi.fn()
 window.addEventListener('vessel-browser-tab-action',action)
 try {
  render(<BookmarkBar items={[{title:'Example',url:'https://example.com/page'}]} onNavigate={navigate} onOpenNewTab={(url)=>browserTabAction('new',undefined,url)} />)
  fireEvent.contextMenu(screen.getByRole('button',{name:'Example'}))
  fireEvent.click(screen.getByRole('menuitem',{name:'在新标签页打开'}))
  expect(action).toHaveBeenCalledOnce()
  expect(action.mock.calls[0][0].detail).toEqual({action:'new',id:undefined,url:'https://example.com/page'})
  expect(navigate).not.toHaveBeenCalled()
  fireEvent.contextMenu(screen.getByRole('button',{name:'Example'}))
  fireEvent.click(screen.getByRole('menuitem',{name:'打开链接'}))
  expect(navigate).toHaveBeenCalledWith('https://example.com/page')
 } finally { window.removeEventListener('vessel-browser-tab-action',action) }
})
