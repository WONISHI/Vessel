import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GitDiffSheet } from '@/pages/git/components/git-diff-sheet'
import { DiffViewer } from '@/pages/git/components/diff-viewer'
vi.mock('@/components/ui/sonner', () => ({toast:{success:vi.fn()}}))
beforeEach(() => {
 vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId = 1; pointerType = 'mouse' })
 HTMLElement.prototype.setPointerCapture = vi.fn()
 HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const patch = (text: string) => `--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+${text}\n`
it('resizes the bottom Sheet with pointer dragging and keyboard while retaining live diff content', () => {
 const dock = vi.fn()
 const view = render(<GitDiffSheet onDockRight={dock}><DiffViewer diffText={patch("first patch")} filePath="first.ts" bottomDocked onToggleDock={dock} /></GitDiffSheet>)
 const sheet = screen.getByRole('dialog',{name:'文件差异'})
 const handle = screen.getByRole('separator',{name:'调整差异面板高度'})
 const initial = parseFloat(sheet.style.height)
 fireEvent.pointerDown(handle,{button:0,clientY:500})
 fireEvent.pointerMove(handle,{clientY:450})
 fireEvent.pointerUp(handle,{button:0,clientY:450})
 expect(parseFloat(sheet.style.height)).toBe(initial+50)
 fireEvent.keyDown(handle,{key:'ArrowDown'})
 expect(parseFloat(sheet.style.height)).toBe(initial+30)
 fireEvent.pointerDown(handle,{button:0,clientY:500})
 fireEvent.pointerMove(handle,{clientY:5000})
 fireEvent.pointerUp(handle,{button:0,clientY:5000})
 expect(sheet.style.height).toBe('160px')
 view.rerender(<GitDiffSheet onDockRight={dock}><DiffViewer diffText={patch("second patch")} filePath="second.ts" bottomDocked onToggleDock={dock} /></GitDiffSheet>)
 expect(screen.getByText('second patch')).toBeTruthy()
 expect(screen.queryByText('first patch')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'停靠到右侧'}))
 expect(dock).toHaveBeenCalledOnce()
})
it('keeps the docking action available when a selected file has no diff', () => {
 const dock = vi.fn()
 render(<DiffViewer diffText="" bottomDocked onToggleDock={dock} />)
 fireEvent.click(screen.getByRole('button',{name:'停靠到右侧'}))
 expect(dock).toHaveBeenCalledOnce()
 expect(screen.getByText('该文件暂无差异变更')).toBeTruthy()
})
