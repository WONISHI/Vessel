import { publishGitStatusView } from "@/pages/git/file-picker-state"
import { setActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StatusBar } from '@/components/ui/status-bar'
import { setStatusBarVisible } from '@/features/status-bar/visibility'
import { addTransit } from '@/components/transit/state'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TopSearch } from '@/components/layout/top-search'
import { publishBrowserTabs } from '@/pages/browser/tab-state'
vi.mock('@/components/layout/feature-page-overlay', () => ({ FeaturePageOverlay: ({ feature, tool, onToolChange }: any) => feature ? <div role="dialog" aria-label={feature === 'todos' ? '待办' : '开发工具'}><span>{tool}</span><button onClick={() => onToolChange('color')}>切换颜色工具</button></div> : null }))
vi.mock('@/components/workspace-file-picker', () => ({ WorkspaceFilePicker: ({ workspace }: any) => <div>{workspace?.root || 'empty'}</div> }))
beforeEach(() => {
 publishGitStatusView(true)
 vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(['/debug/performance', '/debug/system', '/debug/storage'])('returns directly to home from %s', (path) => {
 function Location() { return <output data-testid="current-route">{useLocation().pathname}</output> }
 render(<MemoryRouter initialEntries={[path]}><TopSearch /><Location /></MemoryRouter>)
 fireEvent.click(screen.getByRole('button', { name: '回到首页' }))
 expect(screen.getByTestId('current-route').textContent).toBe('/')
 expect(screen.queryByRole('button', { name: '回到首页' })).toBeNull()
})
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
 expect(screen.getByRole('dialog', { name: '开发工具' })).toBeTruthy()
 expect(screen.getByText('/editor')).toBeTruthy()
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
 expect(screen.getByRole('dialog', { name: '待办' })).toBeTruthy()
 expect(screen.getByText('/editor')).toBeTruthy()
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

it.each([['待办', '/todos'], ['查看关系图谱', '/editor/graph'], ['开发工具', '/devtools']])('preserves shared layout settings when opening and closing %s', (label) => {
 setActivityBarCollapsed(true)
 setStatusBarVisible(false)
 function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output> }
 try {
  render(<MemoryRouter initialEntries={['/editor/file?path=kept.md']}><TopSearch /><Location /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByLabelText('显示活动栏')).toBeTruthy()
  expect(screen.getByLabelText('显示底部状态栏')).toBeTruthy()
  expect(screen.getByRole('button', { name: '活动栏菜单' })).toBeTruthy()
  // Reopening the same feature must not reset layout preferences.
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByLabelText('显示活动栏')).toBeTruthy()
  expect(screen.getByLabelText('显示底部状态栏')).toBeTruthy()
  const closeLabel = '关闭' + label.replace('查看', '')
  fireEvent.click(screen.getByRole('button', { name: closeLabel }))
  expect(screen.getByText('/editor/file?path=kept.md')).toBeTruthy()
  expect(screen.getByLabelText('显示活动栏')).toBeTruthy()
  // A user change within the feature applies to the rest of the application too.
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.click(screen.getByLabelText('显示活动栏'))
  fireEvent.click(screen.getByLabelText('显示底部状态栏'))
  fireEvent.click(screen.getByRole('button', { name: closeLabel }))
  expect(screen.getByLabelText('隐藏活动栏')).toBeTruthy()
  expect(screen.getByLabelText('隐藏底部状态栏')).toBeTruthy()
  expect(localStorage.getItem('vessel-activity-bar-collapsed')).toBe('false')
  expect(localStorage.getItem('vessel-status-bar-visible')).toBe('true')
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

it('refocuses an open picker without clearing the query when Space is pressed twice on a result', () => {
 publishBrowserTabs([{ id:'active', title:'文档', url:'https://docs.test', active:true }])
 render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
 doubleSpace()
 const input = screen.getByLabelText('标签名称或网址') as HTMLInputElement
 fireEvent.change(input, { target: { value: '文档' } })
 const row = screen.getByRole('option')
 act(() => row.focus())
 expect(document.activeElement).toBe(row)
 doubleSpace(row)
 expect(document.activeElement).toBe(input)
 expect(input.value).toBe('文档')
})

it.each(['/browser', '/git', '/editor'])('exposes navigation when the activity rail is hidden on %s', async (path) => {
 vi.stubGlobal('electronAPI', { getSettings: vi.fn(async () => ({ globalSearchEnabled: false, attachmentLibraryEnabled: true })) })
 function Location() { return <output>{useLocation().pathname}</output> }
 const view = render(<MemoryRouter initialEntries={[path]}><TopSearch /><Location /></MemoryRouter>)
 try {
  expect(screen.queryByRole('button', { name: '活动栏菜单' })).toBeNull()
  fireEvent.click(screen.getByLabelText('隐藏活动栏'))
  fireEvent.keyDown(screen.getByRole('button', { name: '活动栏菜单' }), { key: 'Enter' })
  expect(await screen.findByRole('menuitem', { name: '附件库' })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: '全局搜索' })).toBeNull()
  expect(screen.getByRole('menuitem', { name: path === '/editor' ? '工作区' : path === '/git' ? 'Git' : '浏览器' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('menuitem', { name: 'API' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('/api-client'))
  fireEvent.click(screen.getByLabelText('显示活动栏'))
  expect(screen.queryByRole('button', { name: '活动栏菜单' })).toBeNull()
 } finally { view.unmount(); setActivityBarCollapsed(false) }
})

it('opens and switches full-page utility overlays without navigating or clearing the underlying page', () => {
 function Location() { const location = useLocation(); return <output>{location.key + ':' + location.pathname + location.search}</output> }
 render(<MemoryRouter initialEntries={['/browser?kept=1']}><TopSearch /><Location /><input aria-label="底层页面内容" defaultValue="原内容" /></MemoryRouter>)
 const base = screen.getByRole('status').textContent
 const input = screen.getByLabelText('底层页面内容') as HTMLInputElement
 fireEvent.change(input, { target: { value: '未保存内容' } })
 fireEvent.click(screen.getByRole('button', { name: '待办' }))
 expect(screen.getByRole('dialog', { name: '待办' })).toBeTruthy()
 expect(screen.getByRole('status').textContent).toBe(base)
 fireEvent.click(screen.getByRole('button', { name: '开发工具' }))
 expect(screen.queryByRole('dialog', { name: '待办' })).toBeNull()
 expect(screen.getByRole('dialog', { name: '开发工具' })).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: '切换颜色工具' }))
 expect(screen.getByText('颜色转换')).toBeTruthy()
 expect(screen.getByRole('status').textContent).toBe(base)
 fireEvent.click(screen.getByRole('button', { name: '关闭开发工具' }))
 expect(screen.queryByRole('dialog')).toBeNull()
 expect(screen.getByRole('status').textContent).toBe(base)
 expect(input.value).toBe('未保存内容')
})

it.each([['/editor', true], ['/editor/file', true], ['/resources', true], ['/browser', true], ['/todos', false], ['/devtools/json', false], ['/git', false], ['/settings', false], ['/editor/graph', false]])('shows status-bar fallback tools only where supported: %s', (path, expected) => {
 setStatusBarVisible(false)
 try {
  render(<MemoryRouter initialEntries={[path]}><TopSearch /></MemoryRouter>)
  expect(Boolean(screen.queryByRole('button', { name: '页面工具' }))).toBe(expected)
  expect(screen.getByRole('button', { name: '开发工具' }).querySelector('.codicon-developer-tools')).toBeTruthy()
  if (expected) {
   fireEvent.click(screen.getByLabelText('显示底部状态栏'))
   expect(screen.queryByRole('button', { name: '页面工具' })).toBeNull()
  }
 } finally { cleanup(); setStatusBarVisible(true) }
})

it.each(['/editor', '/resources'])('toggles the existing console and follows external visibility changes on %s', (path) => {
 setStatusBarVisible(false)
 let visible = true
 const publish = () => window.dispatchEvent(new CustomEvent('vessel:workspace-console-state', { detail: visible }))
 const toggle = vi.fn(() => { visible = !visible; publish() })
 window.addEventListener('vessel:toggle-workspace-console', toggle)
 window.addEventListener('vessel:request-workspace-console-state', publish)
 try {
  render(<MemoryRouter initialEntries={[path]}><TopSearch /></MemoryRouter>)
  const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: '页面工具' }), { key: 'Enter' })
  openMenu()
  expect(screen.queryByRole('menuitem', { name: '搜索' })).toBeNull()
  const close = screen.getByRole('menuitem', { name: '关闭控制台' })
  expect(close.querySelector('.lucide-square-terminal')).toBeTruthy()
  fireEvent.click(close)
  expect(toggle).toHaveBeenCalledOnce()
  openMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: '打开控制台' }))
  expect(toggle).toHaveBeenCalledTimes(2)
  visible = false
  act(publish)
  openMenu()
  expect(screen.getByRole('menuitem', { name: '打开控制台' })).toBeTruthy()
 } finally {
  cleanup(); setStatusBarVisible(true)
  window.removeEventListener('vessel:toggle-workspace-console', toggle)
  window.removeEventListener('vessel:request-workspace-console-state', publish)
 }
})

it('provides browser toolbar and find actions without a workspace-console action', () => {
 setStatusBarVisible(false)
 const toggle = vi.fn(), search = vi.fn()
 window.addEventListener('vessel-browser-toggle-toolbar', toggle)
 window.addEventListener('vessel-browser-open-find', search)
 try {
  render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
  const open = () => fireEvent.keyDown(screen.getByRole('button', { name: '页面工具' }), { key: 'Enter' })
  open()
  expect(screen.queryByRole('menuitem', { name: '打开控制台' })).toBeNull()
  fireEvent.click(screen.getByRole('menuitem', { name: '折叠搜索栏' }))
  expect(toggle).toHaveBeenCalledOnce()
  act(() => window.dispatchEvent(new CustomEvent('vessel-browser-toolbar-state', { detail: true })))
  open()
  expect(screen.getByRole('menuitem', { name: '展开搜索栏' })).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitem', { name: '搜索' }))
  expect(search).toHaveBeenCalledOnce()
 } finally {
  cleanup(); setStatusBarVisible(true)
  window.removeEventListener('vessel-browser-toggle-toolbar', toggle)
  window.removeEventListener('vessel-browser-open-find', search)
 }
})

it('switches adjacent browser tabs without navigating browser history', () => {
 const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
 const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => {})
 const select = vi.fn()
 window.addEventListener('vessel-browser-tab', select)
 try {
  publishBrowserTabs([{id:'first',title:'一',url:'https://one.test',active:false},{id:'middle',title:'二',url:'https://two.test',active:true},{id:'last',title:'三',url:'https://three.test',active:false}])
  render(<MemoryRouter initialEntries={['/browser']}><TopSearch /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:'上一个标签页'}))
  expect(select.mock.lastCall?.[0].detail).toBe('first')
  fireEvent.click(screen.getByRole('button',{name:'下一个标签页'}))
  expect(select.mock.lastCall?.[0].detail).toBe('last')
  expect(back).not.toHaveBeenCalled()
  expect(forward).not.toHaveBeenCalled()
  act(() => publishBrowserTabs([{id:'first',title:'一',url:'https://one.test',active:true}]))
  expect((screen.getByRole('button',{name:'上一个标签页'}) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button',{name:'下一个标签页'}) as HTMLButtonElement).disabled).toBe(true)
 } finally { window.removeEventListener('vessel-browser-tab', select); back.mockRestore(); forward.mockRestore() }
})

it('switches resource document tabs in displayed pinned order and ignores a cached different project', () => {
 const openFile = vi.fn(), cached = vi.fn()
 const files = [{name:'a.ts',path:'/tab-project/a.ts'},{name:'b.ts',path:'/tab-project/b.ts'},{name:'pinned.ts',path:'/tab-project/pinned.ts'}]
 localStorage.setItem('resource_current_project', JSON.stringify({name:'项目',path:'/tab-project'}))
 localStorage.setItem('vessel-pinned-tabs', JSON.stringify([files[2].path]))
 const listener = (event: Event) => {
  const provide = (event as CustomEvent).detail
  expect(provide.scope).toBe('resources')
  provide({root:'/cached-project',files:[{name:'old',path:'/cached-project/old'}],activePath:'',openFile:cached})
  provide({root:'/tab-project',files,activePath:files[0].path,openFile})
 }
 window.addEventListener('vessel:request-workspace-files', listener)
 try {
  render(<MemoryRouter initialEntries={['/resources/file']}><TopSearch /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:'上一个标签页'}))
  expect(openFile).toHaveBeenLastCalledWith(files[2])
  fireEvent.click(screen.getByRole('button',{name:'下一个标签页'}))
  expect(openFile).toHaveBeenLastCalledWith(files[1])
  expect(cached).not.toHaveBeenCalled()
 } finally { window.removeEventListener('vessel:request-workspace-files', listener); localStorage.removeItem('resource_current_project'); localStorage.removeItem('vessel-pinned-tabs') }
})

it('searches only Git status entries without requesting workspace files', () => {
 const select = vi.fn(), workspaceRequest = vi.fn()
 const provide = (event: Event) => (event as CustomEvent).detail({ repoPath: '/repo', entries: [{ id: 'staged:a', section: 'staged', file: { path: 'src/change.ts', status: 'M' } }], select })
 window.addEventListener('vessel:request-git-files', provide)
 window.addEventListener('vessel:request-workspace-files', workspaceRequest)
 try {
  render(<MemoryRouter initialEntries={['/git']}><TopSearch /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '搜索 Git 变更文件' }))
  expect(screen.getByLabelText('Git 变更文件关键词')).toBeTruthy()
  fireEvent.click(screen.getByText('change.ts'))
  expect(select.mock.calls[0][0].section).toBe('staged')
  expect(workspaceRequest).not.toHaveBeenCalled()
 } finally {
  window.removeEventListener('vessel:request-git-files', provide)
  window.removeEventListener('vessel:request-workspace-files', workspaceRequest)
 }
})

it('switches Git changes with titlebar arrows instead of workspace tabs', () => {
 const select = vi.fn(), workspaceRequest = vi.fn()
 const entries = [
  { id: 'staged:a', section: 'staged', file: { path: 'a.ts', status: 'M' } },
  { id: 'worktree:a', section: 'unstaged', file: { path: 'a.ts', status: 'M' } },
  { id: 'worktree:b', section: 'unstaged', file: { path: 'b.ts', status: 'M' } }
 ]
 const provide = (event: Event) => (event as CustomEvent).detail({ entries, activeId: 'worktree:a', select })
 window.addEventListener('vessel:request-git-files', provide)
 window.addEventListener('vessel:request-workspace-files', workspaceRequest)
 try {
  render(<MemoryRouter initialEntries={['/git']}><TopSearch /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '上一个变更文件' }))
  expect(select).toHaveBeenLastCalledWith(entries[0])
  fireEvent.click(screen.getByRole('button', { name: '下一个变更文件' }))
  expect(select).toHaveBeenLastCalledWith(entries[2])
  expect(workspaceRequest).not.toHaveBeenCalled()
 } finally {
  window.removeEventListener('vessel:request-git-files', provide)
  window.removeEventListener('vessel:request-workspace-files', workspaceRequest)
 }
})

it('hides Git change search and arrows outside file status and restores them on return', () => {
 render(<MemoryRouter initialEntries={['/git']}><TopSearch /></MemoryRouter>)
 fireEvent.click(screen.getByRole('button', { name: '搜索 Git 变更文件' }))
 act(() => publishGitStatusView(false))
 expect(screen.queryByRole('button', { name: '搜索 Git 变更文件' })).toBeNull()
 expect(screen.queryByRole('button', { name: '上一个变更文件' })).toBeNull()
 expect(screen.queryByLabelText('Git 变更文件关键词')).toBeNull()
 act(() => publishGitStatusView(true))
 expect(screen.getByRole('button', { name: '搜索 Git 变更文件' })).toBeTruthy()
 expect(screen.queryByLabelText('Git 变更文件关键词')).toBeNull()
})
