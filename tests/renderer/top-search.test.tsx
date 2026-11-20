import { setActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StatusBar } from '@/components/ui/status-bar'
import { setStatusBarVisible } from '@/features/status-bar/visibility'
import { addTransit } from '@/components/transit/state'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopSearch } from '@/components/layout/top-search'
import { publishBrowserTabs } from '@/pages/browser/tab-state'
vi.mock('@/components/workspace-file-picker', () => ({ WorkspaceFilePicker: ({ workspace }: any) => <div>{workspace?.root || 'empty'}</div> }))
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
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
 await waitFor(() => expect(screen.getByText('浏览器').style.transform).toBe('translateX(-86px)'))
 act(() => changed?.(false))
 expect(screen.getByText('浏览器').style.transform).toBe('translateX(0px)')
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
 const layoutControls = !/^\/(settings|debug)(\/|$)/.test(path)
 expect(Boolean(screen.queryByLabelText('隐藏活动栏'))).toBe(layoutControls)
 expect(Boolean(screen.queryByLabelText('隐藏底部状态栏'))).toBe(layoutControls)
})

const doubleSpace = (target: HTMLElement | Window = window, options = {}) => {
 fireEvent.keyDown(target, { key: ' ', code: 'Space', ...options })
 fireEvent.keyUp(target, { key: ' ', code: 'Space', ...options })
 fireEvent.keyDown(target, { key: ' ', code: 'Space', ...options })
 fireEvent.keyUp(target, { key: ' ', code: 'Space', ...options })
}

it('opens and focuses browser tab search on double Space', () => {
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
 doubleSpace()
 expect(document.activeElement).toBe(screen.getByLabelText('标签名称或网址'))
})

it.each(['/editor', '/resources'])('opens the current file search on double Space in %s', (path) => {
 const listener = vi.fn((event: Event) => {
  const provide = (event as CustomEvent).detail
  expect(provide.scope).toBe(path === '/resources' ? 'resources' : 'workspace')
  provide({ root: '/current-project', files: [], openFile: vi.fn() })
 })
 window.addEventListener('vessel:request-workspace-files', listener)
 try {
  render(<MemoryRouter initialEntries={[path]}><TopSearch /></MemoryRouter>)
  doubleSpace()
  expect(screen.getByText('/current-project')).toBeTruthy()
  expect(listener).toHaveBeenCalledOnce()
 } finally { window.removeEventListener('vessel:request-workspace-files', listener) }
})

it('accepts the active browser guest request and ignores background tabs', () => {
 publishBrowserTabs([{ id:'active',title:'文档',url:'https://docs.test',active:true }, { id:'background',title:'其他',url:'https://other.test',active:false }])
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
 act(() => window.dispatchEvent(new CustomEvent('vessel-browser-open-top-search', { detail: 'background' })))
 expect(screen.queryByLabelText('标签名称或网址')).toBeNull()
 act(() => window.dispatchEvent(new CustomEvent('vessel-browser-open-top-search', { detail: 'active' })))
 expect(document.activeElement).toBe(screen.getByLabelText('标签名称或网址'))
})

it('ignores typing, held Space and modified Space', () => {
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /><input aria-label="编辑内容" /><div contentEditable suppressContentEditableWarning>正文</div></MemoryRouter>)
 doubleSpace(screen.getByLabelText('编辑内容'))
 doubleSpace(screen.getByText('正文'))
 doubleSpace(window, { repeat: true })
 doubleSpace(window, { ctrlKey: true })
 expect(screen.queryByLabelText('标签名称或网址')).toBeNull()
})

it('does not open hidden search on other pages or after unmount', () => {
 const result = render(<MemoryRouter initialEntries={['/settings']}><TopSearch /></MemoryRouter>)
 doubleSpace()
 expect(screen.queryByLabelText('标签名称或网址')).toBeNull()
 result.unmount()
 const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true })
 fireEvent.keyDown(window, { key: ' ', code: 'Space' })
 window.dispatchEvent(event)
 expect(event.defaultPrevented).toBe(false)
})

it('shows creation only with text and closes after requesting a new browser tab', () => {
 const listener = vi.fn()
 window.addEventListener('vessel-browser-tab-action', listener)
 try {
  render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
  fireEvent.click(screen.getByLabelText('搜索浏览器标签'))
  expect(screen.queryByLabelText('新增标签页')).toBeNull()
  fireEvent.change(screen.getByLabelText('标签名称或网址'), { target: { value: 'example.com' } })
  fireEvent.click(screen.getByLabelText('新增标签页'))
  expect(listener.mock.calls[0][0].detail).toEqual({ action: 'new', url: 'https://example.com/' })
  expect(screen.queryByLabelText('标签名称或网址')).toBeNull()
 } finally { window.removeEventListener('vessel-browser-tab-action', listener) }
})

it('keeps transit and developer tools in the titlebar with a live count and concise tooltips', () => {
 function Location() { return <output>{useLocation().pathname}</output> }
 render(<MemoryRouter initialEntries={['/editor']}><TopSearch /><Location /></MemoryRouter>)
 const transit = screen.getByRole('button', { name: '中转站' })
 expect(transit.closest('.vessel-titlebar-actions')).toBeTruthy()
 expect(transit.getAttribute('data-title')).toBe('中转站')
 act(() => addTransit('titlebar count test'))
 expect(transit.textContent).toBe('1')
 fireEvent.click(transit)
 expect(screen.getByText('导入文件')).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: '删除 titlebar count test' }))
 expect(transit.textContent).toBe('')
 fireEvent.click(transit)
 const tools = screen.getByRole('button', { name: '开发工具' })
 expect(tools.closest('.vessel-titlebar-actions')).toBeTruthy()
 expect(tools.getAttribute('data-title')).toBe('开发工具')
 fireEvent.click(tools)
 expect(screen.getByText('/devtools')).toBeTruthy()
})

it('moves the same live clock beside top search when the status bar is hidden', () => {
 vi.useFakeTimers()
 vi.setSystemTime(new Date(2026, 10, 19, 20, 57, 30))
 setStatusBarVisible(true)
 try {
  render(<MemoryRouter initialEntries={['/browser']}><TopSearch /><StatusBar /></MemoryRouter>)
  const footerTime = document.querySelector('footer time')!.textContent
  expect(document.querySelector('.vessel-titlebar-clock')).toBeNull()
  fireEvent.click(screen.getByLabelText('隐藏底部状态栏'))
  expect(screen.queryByLabelText('底部状态栏')).toBeNull()
  const clock = document.querySelector('.vessel-titlebar-clock')!
  expect(clock.querySelector('time')!.textContent).toBe(footerTime)
  expect(clock.textContent).toContain('星期四')
  act(() => vi.advanceTimersByTime(30_100))
  expect(clock.textContent).toContain('20:58')
  fireEvent.click(screen.getByLabelText('查看日历'))
  expect(screen.getByLabelText('只读日历')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('查看日历'))
  fireEvent.click(screen.getByLabelText('显示底部状态栏'))
  expect(document.querySelector('.vessel-titlebar-clock')).toBeNull()
  expect(document.querySelector('footer time')!.textContent).toContain('20:58')
 } finally { cleanup(); setStatusBarVisible(true); vi.useRealTimers() }
})

it('opens todos from its relocated titlebar button', () => {
 function Location() { return <output>{useLocation().pathname}</output> }
 render(<MemoryRouter initialEntries={['/editor']}><TopSearch /><Location /></MemoryRouter>)
 const button = screen.getByRole('button', { name: '待办' })
 expect(button.closest('.vessel-titlebar-actions')).toBeTruthy()
 expect(button.getAttribute('data-title')).toBe('待办')
 fireEvent.click(button)
 expect(screen.getByText('/todos')).toBeTruthy()
 expect(button.getAttribute('aria-pressed')).toBe('true')
})

it.each(['/settings', '/settings/about', '/debug', '/debug/performance', '/debug/storage'])('hides layout toggles on %s', (path) => {
 render(<MemoryRouter initialEntries={[path]}><TopSearch /></MemoryRouter>)
 expect(screen.queryByRole('group', { name: '布局显示' })).toBeNull()
 expect(screen.getByLabelText('待办')).toBeTruthy()
 expect(screen.getByLabelText('中转站')).toBeTruthy()
})

it.each(['/editor', '/editor/file', '/resources', '/browser', '/todos', '/settings', '/debug/performance'])('only exposes the graph in workspace on %s', (path) => {
 function Location() { return <output>{useLocation().pathname}</output> }
 render(<MemoryRouter initialEntries={[path]}><TopSearch /><Location /></MemoryRouter>)
 const button = screen.queryByRole('button', { name: '查看关系图谱' })
 expect(Boolean(button)).toBe(path.startsWith('/editor'))
 if (button) {
  expect(button.closest('.vessel-titlebar-actions')).toBeTruthy()
  fireEvent.click(button)
  expect(screen.getByText('/editor/graph')).toBeTruthy()
  expect(button.getAttribute('aria-pressed')).toBe('true')
 }
})

it.each([['待办', '/todos'], ['查看关系图谱', '/editor/graph'], ['开发工具', '/devtools']])('temporarily resets layout for %s and restores saved preferences on exit', (label) => {
 setActivityBarCollapsed(true)
 setStatusBarVisible(false)
 function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output> }
 try {
  render(<MemoryRouter initialEntries={['/editor/file?path=kept.md']}><TopSearch /><Location /></MemoryRouter>)
  expect(screen.getByLabelText('显示活动栏')).toBeTruthy()
  expect(screen.getByLabelText('显示底部状态栏')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByLabelText('隐藏活动栏')).toBeTruthy()
  expect(screen.getByLabelText('隐藏底部状态栏')).toBeTruthy()
  expect(localStorage.getItem('vessel-activity-bar-collapsed')).toBe('true')
  expect(localStorage.getItem('vessel-status-bar-visible')).toBe('false')
  fireEvent.click(screen.getByLabelText('隐藏活动栏'))
  fireEvent.click(screen.getByLabelText('隐藏底部状态栏'))
  // Clicking the feature again restores temporary defaults too.
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByLabelText('隐藏活动栏')).toBeTruthy()
  expect(screen.getByLabelText('隐藏底部状态栏')).toBeTruthy()
  const close = screen.getByRole('button', { name: '关闭' + label.replace('查看', '') })
  expect(close.getAttribute('data-title')).toBe('关闭')
  fireEvent.click(close)
  expect(screen.getByText('/editor/file?path=kept.md')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '关闭' + label.replace('查看', '') })).toBeNull()
  expect(screen.getByLabelText('显示活动栏')).toBeTruthy()
  expect(screen.getByLabelText('显示底部状态栏')).toBeTruthy()
 } finally { cleanup(); setActivityBarCollapsed(false); setStatusBarVisible(true) }
})

it('returns to the original page after switching between feature views', () => {
 function Location() { return <output>{useLocation().pathname}</output> }
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /><Location /></MemoryRouter>)
 fireEvent.click(screen.getByRole('button', { name: '待办' }))
 fireEvent.click(screen.getByRole('button', { name: '开发工具' }))
 fireEvent.click(screen.getByRole('button', { name: '关闭开发工具' }))
 expect(screen.getByText('/browser')).toBeTruthy()
})
