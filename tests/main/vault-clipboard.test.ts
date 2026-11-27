import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ text: '', clear: vi.fn() }))
vi.mock('electron', () => ({ clipboard: { writeText: (value: string) => { state.text = value }, readText: () => state.text, clear: () => { state.text = ''; state.clear() } } }))
import { clearVaultClipboardSecret, copyVaultSecret, isVaultClipboardSecret } from '@main/vault/clipboard'
afterEach(() => { clearVaultClipboardSecret(); vi.useRealTimers(); state.clear.mockClear() })
it('marks password copies for history exclusion and clears only the unchanged password after thirty seconds', () => {
  vi.useFakeTimers()
  copyVaultSecret('private-site-secret')
  expect(isVaultClipboardSecret(state.text)).toBe(true)
  expect(isVaultClipboardSecret('other content')).toBe(false)
  vi.advanceTimersByTime(29999)
  expect(state.text).toBe('private-site-secret')
  vi.advanceTimersByTime(1)
  expect(state.text).toBe('')
  expect(state.clear).toHaveBeenCalledOnce()
  copyVaultSecret('another-secret')
  state.text = 'user copied something else'
  vi.advanceTimersByTime(30000)
  expect(state.text).toBe('user copied something else')
  expect(state.clear).toHaveBeenCalledOnce()
})
it('removes a still-copied secret immediately on vault lock/logout', () => {
  copyVaultSecret('secret-at-logout')
  clearVaultClipboardSecret()
  expect(state.text).toBe('')
  expect(isVaultClipboardSecret('secret-at-logout')).toBe(false)
})
