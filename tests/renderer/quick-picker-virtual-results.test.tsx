import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { VirtualResults } from '@/components/workspace-file-picker/virtual-results'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('fills a fast scroll synchronously even while a resize range is still queued', () => {
 let resize!: () => void
 vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
 const viewport = document.createElement('div')
 document.body.appendChild(viewport)
 Object.defineProperty(viewport, 'clientHeight', { value: 240 })
 const items = Array.from({ length: 5000 }, (_, index) => index)
 const { unmount } = render(<VirtualResults items={items} viewport={viewport} getKey={String} renderRow={(value) => <span data-row={value}>{value}</span>} />, { container: viewport })
 act(() => {
   viewport.scrollTop = 60000
   resize()
   viewport.scrollTop = 60030
   viewport.dispatchEvent(new Event('scroll'))
   // Assert before React completes the surrounding batch: blank frames used to occur here.
   expect(viewport.querySelector('[data-row="2001"]')).toBeTruthy()
 })
 expect(viewport.querySelectorAll('[data-row]').length).toBeLessThan(60)
 unmount(); viewport.remove()
})
it('repairs the rendered range before paint when indexing changes the result count', () => {
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
 const viewport = document.createElement('div'); document.body.appendChild(viewport)
 Object.defineProperty(viewport, 'clientHeight', { value: 240 })
 const props = { viewport, getKey: String, renderRow: (value: number) => <span data-row={value}>{value}</span> }
 const { rerender, unmount } = render(<VirtualResults {...props} items={Array.from({length:5000},(_,i)=>i)} />, {container:viewport})
 act(() => { viewport.scrollTop=90000; viewport.dispatchEvent(new Event('scroll')) })
 rerender(<VirtualResults {...props} items={[0,1,2,3,4]} />)
 expect(viewport.querySelectorAll('[data-row]')).toHaveLength(5)
 unmount(); viewport.remove()
})
