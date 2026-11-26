import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GitDialogs } from '@/pages/git/components/git-dialogs'
import type { GitPageModel } from '@/pages/git/hooks/use-git-page'
const terminal = vi.hoisted(() => ({ key: vi.fn() }))
vi.mock('@/components/workspace/components/layout-main/terminal-panel', () => ({ TerminalPanel: () => <textarea aria-label="终端输入" onKeyDown={terminal.key} /> }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('keeps Escape available to the terminal without dismissing the repository dialog, and still allows explicit closing', () => {
  const close = vi.fn()
  const g = { repoPath: '/repo', terminalOpen: true, setTerminalOpen: close, branches: { current: 'main', local: [] }, repositorySettingsOpen: false, createBranchOpen: false, mergeBranchOpen: false } as unknown as GitPageModel
  render(<GitDialogs g={g} />)
  const input = screen.getByRole('textbox', { name: '终端输入' })
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', keyCode: 27 })
  expect(terminal.key).toHaveBeenCalledOnce()
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: '仓库终端' })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('dialog', { name: '仓库终端' }), { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledWith(false)
})
