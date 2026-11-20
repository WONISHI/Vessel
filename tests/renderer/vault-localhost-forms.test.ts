// @vitest-environment-options {"url":"http://localhost:9525/login"}
import { afterEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => void>(), send: vi.fn() }))
vi.mock('electron', () => ({ ipcRenderer: { on: (name: string, fn: (...args: any[]) => void) => mock.handlers.set(name, fn), send: mock.send } }))
import { bindVaultForms } from '../../src/preload/vault-forms'
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers() })
it('captures a trusted localhost login submission, deduplicates it and fills only the exact origin', () => {
 vi.useFakeTimers()
 const added = vi.spyOn(window, 'addEventListener')
 bindVaultForms()
 document.body.innerHTML = '<form><input type="text" placeholder="请输入手机号/账号"><input type="password" placeholder="请输入密码"><button type="submit">立即登录</button></form>'
 const form = document.querySelector('form')!
 const [username, password] = [...form.querySelectorAll('input')]
 for (const input of [username, password]) vi.spyOn(input, 'getClientRects').mockReturnValue([{}] as never)
 username.value = 'local-test-user'; password.value = 'dummy-test-password'
 const submit = added.mock.calls.find(([type]) => type === 'submit')![1] as (event: Event) => void
 submit({ isTrusted: false, target: form } as unknown as Event)
 expect(mock.send).not.toHaveBeenCalled()
 submit({ isTrusted: true, target: form } as unknown as Event)
 expect(mock.send).toHaveBeenCalledWith('vault:submit', { username: 'local-test-user', password: 'dummy-test-password' })
 submit({ isTrusted: true, target: form } as unknown as Event)
 expect(mock.send).toHaveBeenCalledOnce()
 username.value = ''; password.value = ''
 const fill = mock.handlers.get('vault:fill')!
 fill({}, { origin: 'http://localhost:9523', username: 'wrong', password: 'wrong' })
 expect(password.value).toBe('')
 fill({}, { origin: 'http://127.0.0.1:9525', username: 'wrong', password: 'wrong' })
 expect(password.value).toBe('')
 fill({}, { origin: 'http://localhost:9525', username: 'local-test-user', password: 'dummy-test-password' })
 expect(username.value).toBe('local-test-user'); expect(password.value).toBe('dummy-test-password')
 mock.send.mockClear()
 form.action = 'http://localhost:9523/login'
 username.value = 'another'; password.value = 'another-dummy-password'
 submit({ isTrusted: true, target: form } as unknown as Event)
 expect(mock.send).not.toHaveBeenCalled()
})
