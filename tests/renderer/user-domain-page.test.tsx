import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import UserDomainPage from '@/pages/login/user-domain'
const router = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('@vessel/react-router', () => ({ useRouter: () => router }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
function setup(connect = vi.fn().mockResolvedValue({ configured: true, connected: true })) {
  vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  vi.stubGlobal('electronAPI', { databaseSync: { connect } })
  render(<UserDomainPage />)
  return connect
}
it('connects a URI and continues to account registration without settings rows', async () => {
  const connect = setup()
  fireEvent.change(screen.getByLabelText('PostgreSQL 连接字符串'), { target: { value: 'postgresql://owner:secret@host/db' } })
  fireEvent.click(screen.getByRole('button', { name: '连接并继续' }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login?mode=register'))
  expect(connect).toHaveBeenCalledWith(expect.objectContaining({ host: 'host', password: 'secret', database: 'db' }))
  expect(document.querySelector('.settings-row')).toBeNull()
})
it('parses fields for manual editing and preserves them after connection failure', async () => {
  const connect = setup(vi.fn().mockRejectedValue(new Error('连接失败')))
  fireEvent.change(screen.getByLabelText('PostgreSQL 连接字符串'), { target: { value: 'postgresql://owner:secret@host/db' } })
  fireEvent.click(screen.getByRole('button', { name: '手动填写' }))
  expect((screen.getByLabelText('主机地址') as HTMLInputElement).value).toBe('host')
  fireEvent.click(screen.getByRole('button', { name: '连接并继续' }))
  expect((await screen.findByRole('alert')).textContent).toContain('连接失败')
  expect((screen.getByLabelText('数据库密码') as HTMLInputElement).value).toBe('secret')
  expect(connect).toHaveBeenCalledOnce()
  expect(router.replace).not.toHaveBeenCalled()
})
it('returns to login without connecting', () => {
  const connect = setup()
  fireEvent.click(screen.getByRole('button', { name: '返回登录' }))
  expect(router.replace).toHaveBeenCalledWith('/login')
  expect(connect).not.toHaveBeenCalled()
})
