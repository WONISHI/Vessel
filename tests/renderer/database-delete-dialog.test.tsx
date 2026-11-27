import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DeleteDatabaseDialog } from '@/components/core/devtool/components/DeleteDatabaseDialog'
import { DevToolsMenu } from '@/components/core/devtool/components/DevToolsMenu'
import { DropdownMenu } from '@/components/ui/dropdown-menu'
import { DEFAULT_ENABLED_TYPES } from '@/components/core/devtool/src/constants'
import { DATABASE_DELETE_CONFIRMATION } from '@vessel/type/database-sync'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(['local','both','remote'] as const)('requires exact typed confirmation before deleting %s data', async scope => {
  const remove = vi.fn().mockResolvedValue({ restarting: scope !== 'remote' })
  vi.stubGlobal('electronAPI', { databaseSync: { deleteData: remove } })
  const close = vi.fn()
  render(<DeleteDatabaseDialog scope={scope} onClose={close} />)
  const button = screen.getByRole('button', { name: scope === 'remote' ? '确认删除' : '删除并重启' })
  expect(button).toHaveProperty('disabled', true)
  const input = screen.getByLabelText('删除数据确认文字')
  fireEvent.change(input, { target: { value: DATABASE_DELETE_CONFIRMATION[scope] + ' ' } })
  expect(button).toHaveProperty('disabled', true)
  fireEvent.change(input, { target: { value: DATABASE_DELETE_CONFIRMATION[scope] } })
  expect(button).toHaveProperty('disabled', false)
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(button)
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(scope, DATABASE_DELETE_CONFIRMATION[scope]))
  expect(close).toHaveBeenCalledOnce()
})
it.each([false,true])('only exposes remote deletion when configured=%s', async configured => {
  render(<DropdownMenu open><DevToolsMenu isSpyEnabled={false} enabledTypes={DEFAULT_ENABLED_TYPES} hasError={false} menuItems={[]} onToggleSpy={() => {}} onToggleType={() => {}} databaseSyncConfigured={configured} remoteDeletionAvailable onDeleteData={() => {}} /></DropdownMenu>)
  fireEvent.keyDown(screen.getByRole('menuitem', { name: '删除数据', exact: true }), { key: 'ArrowRight' })
  expect(await screen.findByRole('menuitem', { name: '删除本地域（数据库）', exact: true })).toBeTruthy()
  expect(!!screen.queryByRole('menuitem', { name: '删除远程域（数据库）', exact: true })).toBe(configured)
  expect(!!screen.queryByRole('menuitem', { name: '删除本地域（数据库）和远程域（数据库）', exact: true })).toBe(configured)
})
