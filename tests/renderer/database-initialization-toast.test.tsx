import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DatabaseInitializationToast } from '@/pages/settings/components/database-initialization-toast'

const notices = vi.hoisted(() => ({ show: vi.fn(), dismiss: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(notices.show, { dismiss: notices.dismiss, error: notices.error }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

it.each([true, false])('requires an explicit decision and initializes with consent %s', async agree => {
  const status = { configured: true, connected: true, source: 'remote' }
  const initialize = vi.fn().mockResolvedValue(status), complete = vi.fn()
  vi.stubGlobal('electronAPI', { databaseSync: { initialize } })
  render(<DatabaseInitializationToast onComplete={complete} />)
  expect(initialize).not.toHaveBeenCalled()
  const options = notices.show.mock.calls.at(-1)![1]
  expect(options).toMatchObject({ duration: Infinity, dismissible: false, closeButton: false })
  const preventDefault = vi.fn()
  await act(async () => { (agree ? options.action : options.cancel.props).onClick({ preventDefault }) })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(initialize).toHaveBeenCalledExactlyOnceWith(agree)
  expect(complete).toHaveBeenCalledExactlyOnceWith(status)
  expect(notices.dismiss).toHaveBeenCalledWith('database-domain-initialization')
})

it('keeps the choice available after a failed import, allowing a safe retry', async () => {
  const initialize = vi.fn().mockRejectedValueOnce(new Error('连接中断')).mockResolvedValueOnce({ source: 'remote' })
  const complete = vi.fn()
  vi.stubGlobal('electronAPI', { databaseSync: { initialize } })
  render(<DatabaseInitializationToast onComplete={complete} />)
  const options = notices.show.mock.calls.at(-1)![1]
  await act(async () => { options.action.onClick({ preventDefault: vi.fn() }) })
  expect(notices.error).toHaveBeenCalledWith('连接中断')
  expect(notices.dismiss).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
  await act(async () => { options.cancel.props.onClick({ preventDefault: vi.fn() }) })
  expect(initialize).toHaveBeenLastCalledWith(false)
  expect(complete).toHaveBeenCalledOnce()
})
