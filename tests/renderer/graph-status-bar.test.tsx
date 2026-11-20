import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { GraphStatus } from '@/components/workspace/graph/graph-status'
import { StatusTarget } from '@/components/workspace/components/layout-main/status-context'
import { StatusBar } from '@/components/ui/status-bar'
import { LayoutVisibilityControls } from '@/components/layout/layout-visibility-controls'
import { setStatusBarVisible } from '@/features/status-bar/visibility'
const graph = { nodes: [], edges: [], warnings: [], stats: { files: 123, scanned: 3, reused: 120, elapsedMs: 250 } }
afterEach(() => { cleanup(); setStatusBarVisible(true) })
it('puts graph statistics into the one shared status bar and hides them with it', () => {
 function Page() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  return <><LayoutVisibilityControls activity={false} /><StatusTarget.Provider value={target}><GraphStatus graph={graph} /></StatusTarget.Provider><StatusBar><div ref={setTarget} /></StatusBar></>
 }
 render(<Page />)
 expect(document.querySelectorAll('footer')).toHaveLength(1)
 expect(screen.getByLabelText('底部状态栏').textContent).toContain('123 个文件')
 expect(screen.getByRole('button', { name: '查看日历' })).toBeTruthy()
 fireEvent.click(screen.getByLabelText('隐藏底部状态栏'))
 expect(screen.queryByText(/123 个文件/)).toBeNull()
 fireEvent.click(screen.getByLabelText('显示底部状态栏'))
 expect(screen.getByText(/123 个文件/)).toBeTruthy()
})
