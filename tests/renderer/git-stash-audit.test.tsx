import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GitStashHistoryButton } from '@/pages/git/components/git-stash-history'
import { GitStashContentCheckPanel } from '@/pages/git/components/git-stash-content-check'
import type { GitStashContentCheck, GitStashRestoreRecord } from '@vessel/type/git'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const hash = 'a'.repeat(40)
const record: GitStashRestoreRecord = { id: 'restore', hash, name: '合并前保存本地修改', index: 3, stashDate: '2026-11-20T10:00:00Z', at: '2026-11-26T07:00:00Z', branch: 'dev', action: 'pop', outcome: 'applied', conflicts: [], dropped: true }

it('shows history for a popped stash and previews its stable hash without restoring it again', async () => {
  const history = vi.fn().mockResolvedValue([record])
  const restore = vi.fn()
  vi.stubGlobal('electronAPI', { git: { getStashRestoreHistory: history, stashPop: restore } })
  const onView = vi.fn()
  render(<GitStashHistoryButton root="/repo" onView={onView} />)
  fireEvent.click(screen.getByRole('button', { name: '查看贮藏恢复记录' }))
  expect(await screen.findByText('合并前保存本地修改')).toBeTruthy()
  expect(screen.getByText('已恢复过')).toBeTruthy()
  expect(screen.getByText(/当时已移除贮藏记录/)).toBeTruthy()
  expect(screen.getByText(/分支 dev/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '查看保存内容' }))
  expect(onView).toHaveBeenCalledWith({ hash, index: 3, name: record.name, date: record.stashDate })
  expect(restore).not.toHaveBeenCalled()
})

it('shows recorded conflicts as a past outcome, with an honest empty/error history state', async () => {
  const history = vi.fn().mockResolvedValueOnce([{ ...record, outcome: 'conflicts', conflicts: ['file.ts'], dropped: false }]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('无法读取记录'))
  vi.stubGlobal('electronAPI', { git: { getStashRestoreHistory: history } })
  render(<GitStashHistoryButton root="/repo" onView={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '查看贮藏恢复记录' }))
  expect(await screen.findByText('恢复时有冲突')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '刷新' }))
  expect(await screen.findByText(/暂无恢复记录/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '刷新' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '无法读取记录')
})

it('compares content only on request and distinguishes exact matches from restoration history', async () => {
  const result: GitStashContentCheck = { hash, checkedAt: new Date().toISOString(), files: [{ path: 'same.ts', state: 'same' }, { path: 'later-edits.ts', state: 'different' }, { path: 'missing.ts', state: 'missing' }, { path: 'conflict.ts', state: 'unknown' }] }
  const check = vi.fn().mockResolvedValue(result)
  const apply = vi.fn()
  vi.stubGlobal('electronAPI', { git: { checkStashContent: check, stashApply: apply } })
  render(<GitStashContentCheckPanel root="/repo" hash={hash} />)
  expect(check).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '核对当前内容' }))
  expect(await screen.findByText(/1\/4 项内容一致/)).toBeTruthy()
  expect(screen.getByText('内容不同')).toBeTruthy()
  expect(screen.getByText('当前不存在')).toBeTruthy()
  expect(screen.getByText('需手动核对')).toBeTruthy()
  expect(screen.queryByText('已恢复过')).toBeNull()
  expect(apply).not.toHaveBeenCalled()
  expect(check).toHaveBeenCalledWith('/repo', hash)
})

it('discards comparison results from the previous stash after selection changes', async () => {
  let finish!: (value: GitStashContentCheck) => void
  vi.stubGlobal('electronAPI', { git: { checkStashContent: vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve })) } })
  const view = render(<GitStashContentCheckPanel key="first" root="/repo" hash={hash} />)
  fireEvent.click(screen.getByRole('button', { name: '核对当前内容' }))
  view.rerender(<GitStashContentCheckPanel key="second" root="/other" hash={'b'.repeat(40)} />)
  finish({ hash, checkedAt: new Date().toISOString(), files: [{ path: 'stale.ts', state: 'same' }] })
  await waitFor(() => expect(screen.queryByText('stale.ts')).toBeNull())
})
