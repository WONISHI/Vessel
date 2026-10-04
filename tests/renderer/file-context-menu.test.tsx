import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FileActions } from '../../src/renderer/src/pages/workspace/components/layout-aside/layout-workspace-sidebar/file-actions'
vi.mock('../../src/renderer/src/pages/workspace/hooks/useWorkspace', () => ({ useWorkspace: () => ({ workspace: {path:'/workspace'}, openFiles:[] }) }))
afterEach(cleanup)
it('keeps the file highlighted until its Radix context menu closes', () => {
  render(<FileActions node={{name:'document.pdf',path:'/workspace/document.pdf',type:'file'}} onChanged={() => {}}><button>document.pdf</button></FileActions>)
  const row=screen.getByRole('button', {name:'document.pdf'})
  fireEvent.contextMenu(row)
  expect(screen.getByRole('menuitem', {name:'复制文件名'})).toBeTruthy()
  expect(row.parentElement?.className).toContain('!bg-[#f0efed]')
  fireEvent.keyDown(screen.getByRole('menu'), {key:'Escape'})
  expect(screen.queryByRole('menu')).toBeNull()
  expect(row.parentElement?.className).not.toContain('!bg-[#f0efed]')
})
