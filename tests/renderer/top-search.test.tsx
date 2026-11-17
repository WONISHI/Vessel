import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopSearch } from '@/components/layout/top-search'
import { publishBrowserTabs } from '@/pages/browser/tab-state'
vi.mock('@/components/workspace-file-picker', () => ({ WorkspaceFilePicker: ({ workspace }: any) => <div>{workspace?.root || 'empty'}</div> }))
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('searches browser tab titles and URLs and selects the matching tab', () => {
 publishBrowserTabs([{ id:'a',title:'文档',url:'https://docs.test',active:true },{id:'b',title:'项目',url:'https://git.test',active:false}])
 const listener=vi.fn();window.addEventListener('vessel-browser-tab',listener)
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
 fireEvent.click(screen.getByLabelText('搜索浏览器标签'))
 fireEvent.change(screen.getByLabelText('标签名称或网址'),{target:{value:'git.test'}})
 expect(screen.queryByText('https://docs.test')).toBeNull()
 fireEvent.click(screen.getByText('项目'))
 expect(listener.mock.calls[0][0].detail).toBe('b')
 window.removeEventListener('vessel-browser-tab',listener)
})
it('requests the resource project rather than the background workspace', () => {
 const listener=(event: Event)=>{const provide=(event as CustomEvent).detail;expect(provide.scope).toBe('resources');provide({root:'/project',files:[],openFile:vi.fn()})}
 window.addEventListener('vessel:request-workspace-files',listener)
 render(<MemoryRouter initialEntries={['/resources']}><TopSearch /></MemoryRouter>)
 fireEvent.click(screen.getByLabelText('搜索文件和已打开标签'))
 expect(screen.getByText('/project')).toBeTruthy()
 window.removeEventListener('vessel:request-workspace-files',listener)
})

it('reclaims native traffic-light spacing in fullscreen and restores it on exit', async () => {
 let changed: ((value: boolean) => void) | undefined
 const off = vi.fn()
 vi.stubGlobal('electronAPI', { getWindowFullscreenState: vi.fn(async () => true), onWindowFullscreenChanged: (callback: (value: boolean) => void) => { changed = callback; return off } })
 const { unmount } = render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
 await waitFor(() => expect(screen.getByText('浏览器').style.left).toBe('14px'))
 act(() => changed?.(false))
 expect(screen.getByText('浏览器').style.left).toBe('100px')
 unmount()
 expect(off).toHaveBeenCalledOnce()
})

it.each([
 ['/git','Git','lucide-git-branch'], ['/api-client','API','lucide-send'], ['/settings','设置','lucide-settings'],
 ['/devtools/json','JSON 格式化','lucide-braces'], ['/devtools/color','颜色转换','lucide-palette'],
 ['/todos','待办','lucide-calendar-days'], ['/office','ONLYOFFICE','lucide-file-spreadsheet'],
 ['/attachments','附件库','lucide-paperclip'], ['/image','图片','lucide-image'], ['/search','全局搜索','lucide-search'],
 ['/debug/performance','性能监控','lucide-activity'], ['/welcome','首页','lucide-house']
])('shows the matching title and icon on %s', (path, title, iconClass) => {
 render(<MemoryRouter initialEntries={[path]}><TopSearch /></MemoryRouter>)
 expect(screen.getByText(title)).toBeTruthy()
 expect(document.querySelector('.vessel-main-titlebar svg.'+iconClass)).toBeTruthy()
 expect(screen.queryByText('Vessel')).toBeNull()
})
