import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DatabaseSyncSettings } from '@/pages/settings/components/database-sync-settings'
import { parseDatabaseConnection } from '@/pages/settings/components/database-sync-config'
const errors = vi.hoisted(() => vi.fn())
const success = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/sonner', () => ({ toast: { error: errors, success, dismiss: vi.fn() } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('asks before replacing remote data with the local snapshot and prevents duplicate sync requests', async () => {
  let finish!: (value: unknown) => void
  const syncLocal = vi.fn(() => new Promise(resolve => { finish = resolve }))
  vi.stubGlobal('electronAPI', { databaseSync: { status: async () => ({ configured: true, connected: true, source: 'remote', user: { id: 'id', name: 'alice' }, config: { host: 'host', database: 'db' } }), syncLocal } })
  render(<DatabaseSyncSettings />)
  const button = await screen.findByRole('button', { name: '同步本地数据库到远程' })
  fireEvent.click(button)
  expect(screen.getByRole('alertdialog').textContent).toContain('覆盖远程对应表的数据')
  expect(syncLocal).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
  expect(syncLocal).not.toHaveBeenCalled()
  fireEvent.click(button)
  fireEvent.click(screen.getByRole('button', { name: '确认同步', exact: true }))
  expect(syncLocal).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '正在同步…' }).hasAttribute('disabled')).toBe(true)
  finish({ at: new Date().toISOString(), databases: 1, tables: 3, rows: 20 })
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(await screen.findByText(/3 张表/)).toBeTruthy()
})
it('parses URI/config fields and percent-encoded credentials with explicit defaults', () => {
  expect(parseDatabaseConnection('postgresql://owner:p%40ss@host/db?sslmode=require&connect_timeout=30')).toMatchObject({ host: 'host', password: 'p@ss', port: 5432, database: 'db', connectTimeout: 30 })
  expect(parseDatabaseConnection('{"host":"host","user":"owner","database":"db","port":"5433"}')).toMatchObject({ username: 'owner', port: 5433 })
  expect(() => parseDatabaseConnection('mysql://owner:pass@host/db')).toThrow('PostgreSQL')
})
it('moves from successful table setup to registration, then login, before using remote data', async () => {
  const connected = { configured: true, connected: true, config: { host: 'host', database: 'db' } }
  const api = { status: vi.fn().mockResolvedValue({ configured: false, connected: false }), connect: vi.fn().mockResolvedValue(connected), authenticate: vi.fn().mockImplementation(async mode => mode === 'register' ? connected : { ...connected, user: { id: 'id', name: 'alice' } }), upload: vi.fn().mockResolvedValue({ at: new Date().toISOString(), databases: 5, tables: 16, rows: 1234 }) }
  vi.stubGlobal('electronAPI', { databaseSync: api })
  render(<DatabaseSyncSettings />)
  const connection = await screen.findByLabelText('数据库连接字符串')
  fireEvent.change(connection, { target: { value: 'postgresql://owner:db-secret@host/db' } })
  fireEvent.click(screen.getByRole('button', { name: '解析连接字符串' }))
  fireEvent.click(screen.getByRole('button', { name: '连接并创建同步表' }))
  await screen.findByText('创建同步账号')
  expect(api.upload).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'alice' } })
  fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'account-password' } })
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'account-password' } })
  fireEvent.click(screen.getByRole('button', { name: '注册账号', exact: true }))
  await screen.findByText('欢迎回来')
  expect(api.upload).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'account-password' } })
  fireEvent.click(screen.getByRole('button', { name: '登录', exact: true }))
  expect(await screen.findByRole('button', { name: '退出登录并使用本地数据' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('当前使用远程数据库')
  expect(api.upload).not.toHaveBeenCalled()
  expect(api.connect.mock.calls[0][0].password).toBe('db-secret')
  expect(api.authenticate).toHaveBeenLastCalledWith('login', 'alice', 'account-password')
})

it('uses the real authentication API when entering login directly', async () => {
  const connected = { configured: true, connected: false }
  const api = { status: vi.fn().mockResolvedValue(connected), connect: vi.fn().mockResolvedValue({ ...connected, connected: true }), authenticate: vi.fn().mockResolvedValue({ configured: true, connected: true, user: { id: 'id', name: 'alice' } }) }
  vi.stubGlobal('electronAPI', { databaseSync: api })
  const authenticated = vi.fn()
  render(<DatabaseSyncSettings standaloneLogin onAuthenticated={authenticated} />)
  await waitFor(() => expect(api.status).toHaveBeenCalled())
  expect(screen.getByText('欢迎回来')).toBeTruthy()
  expect(screen.queryByText('模拟登录 · 页面预览')).toBeNull()
  fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'alice' } })
  fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'account-password' } })
  fireEvent.click(screen.getByRole('button', { name: '登录', exact: true }))
  await waitFor(() => expect(authenticated).toHaveBeenCalledOnce())
  expect(api.connect).toHaveBeenCalledWith(undefined, undefined)
  expect(api.authenticate).toHaveBeenCalledWith('login', 'alice', 'account-password')
  expect(screen.queryByRole('button', { name: '返回上一页' })).toBeNull()
})

it('opens the independent user-domain page through the login action', async () => {
  vi.stubGlobal('electronAPI', { databaseSync: { status: vi.fn().mockResolvedValue({ configured: false, connected: false }) } })
  const add = vi.fn()
  render(<DatabaseSyncSettings standaloneLogin onAddUserDomain={add} />)
  fireEvent.click(screen.getByRole('button', { name: '添加用户域', exact: true }))
  expect(add).toHaveBeenCalledOnce()
  expect(screen.queryByLabelText('数据库连接字符串')).toBeNull()
})

it.each(['未找到该账号，请先注册', '密码不正确'])('reports login failure %s through Sonner without an IPC prefix or inline error banner', async message => {
  errors.mockClear()
  const api = {
    status: vi.fn().mockResolvedValue({ configured: true, connected: true }),
    authenticate: vi.fn().mockRejectedValue(new Error(`Error invoking remote method 'database-sync:authenticate': Error: ${message}`))
  }
  vi.stubGlobal('electronAPI', { databaseSync: api })
  render(<DatabaseSyncSettings standaloneLogin />)
  await waitFor(() => expect(api.status).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'alice' } })
  fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'wrong-password' } })
  fireEvent.click(screen.getByRole('button', { name: '登录', exact: true }))
  await waitFor(() => expect(errors).toHaveBeenCalledWith(message))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('button', { name: '登录', exact: true }).hasAttribute('disabled')).toBe(false)
})

it.each(['later', 'login', 'empty'])('offers immediate login after registration and handles choice %s', async choice => {
  success.mockClear()
  const connected = { configured: true, connected: true }
  const authenticated = vi.fn()
  const api = {
    status: vi.fn().mockResolvedValue(connected),
    authenticate: vi.fn().mockImplementation(async mode => mode === 'register' ? connected : choice === 'empty'
      ? { ...connected, initializationRequired: true, source: 'local' }
      : { ...connected, user: { id: 'id', name: 'alice' } })
  }
  vi.stubGlobal('electronAPI', { databaseSync: api })
  render(<DatabaseSyncSettings standaloneLogin initialMode="register" onAuthenticated={authenticated} />)
  await waitFor(() => expect(api.status).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('账号'), { target: { value: 'alice' } })
  fireEvent.change(screen.getByLabelText('密码', { exact: true }), { target: { value: 'account-password' } })
  fireEvent.change(screen.getByLabelText('确认密码'), { target: { value: 'account-password' } })
  fireEvent.click(screen.getByRole('button', { name: '注册账号', exact: true }))
  await waitFor(() => expect(success).toHaveBeenCalledWith('注册成功，是否直接登录？', expect.any(Object)))
  expect(api.authenticate).toHaveBeenCalledTimes(1)
  expect((screen.getByLabelText('密码', { exact: true }) as HTMLInputElement).value).toBe('account-password')
  expect((screen.getByLabelText('密码', { exact: true }) as HTMLInputElement).type).toBe('password')
  const options = success.mock.calls.find(([title]) => title === '注册成功，是否直接登录？')![1]
  if (choice === 'later') {
    options.cancel.onClick()
    expect(api.authenticate).toHaveBeenCalledTimes(1)
    expect(authenticated).not.toHaveBeenCalled()
  } else {
    options.action.onClick({ preventDefault: vi.fn() })
    await waitFor(() => expect(api.authenticate).toHaveBeenLastCalledWith('login', 'alice', 'account-password'))
    if (choice === 'empty') {
      await screen.findByRole('button', { name: '请选择是否同步本地数据' })
      expect(authenticated).not.toHaveBeenCalled()
    } else await waitFor(() => expect(authenticated).toHaveBeenCalledOnce())
  }
})
