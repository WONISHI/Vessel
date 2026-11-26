import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GitStagedFiles } from '@/pages/git/components/git-staged-files'
import { GitUnstagedFiles } from '@/pages/git/components/git-unstaged-files'
import { GitConflictFiles } from '@/pages/git/components/git-conflict-files'
import { gitFilePosition } from '@/pages/git/file-position'
import type { GitPageModel } from '@/pages/git/hooks/use-git-page'
import type { GitFileStatus } from '@vessel/type'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }) })
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

it('counts file positions in list/tree order without counting directories or mutating source selection indices', () => {
  const files = ['README.md', 'src/item10.ts', 'src/item2.ts', 'src/components/index.vue'].map(path => ({ path }))
  expect(gitFilePosition(files, 'src/item10.ts')).toBe('2/4')
  expect(gitFilePosition(files, 'src/components/index.vue', true)).toBe('1/4')
  expect(gitFilePosition(files, 'src/item2.ts', true)).toBe('2/4')
  expect(gitFilePosition(files, 'README.md', true)).toBe('4/4')
  expect(files[0].path).toBe('README.md')
  expect(gitFilePosition(files, 'missing')).toBe('0/4')
  expect(gitFilePosition([], undefined)).toBe('0/0')
})

it('updates each header for selection, same-path sections, filters, tree ordering, conflicts and removed files', () => {
  const staged = [{ path: 'README.md', status: 'M' }, { path: 'src/item.ts', status: 'M' }]
  function Fixture() {
    const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null)
    const [activeFileSection, setSection] = useState('staged')
    const [query, setQuery] = useState('')
    const [files, setFiles] = useState(staged)
    const choose = (section: string, file: GitFileStatus) => { setSelectedFile(file); setSection(section) }
    const g = {
      repoPath: '/position', status: { staged: files, unstaged: [{ path: 'README.md', status: 'M' }], untracked: [{ path: 'new.md', status: '?' }], conflicts: [{ path: 'first.md', status: 'U' }, { path: 'second.md', status: 'U' }] },
      selectedFile, activeFileSection,
      selectedStagedPaths: activeFileSection === 'staged' && selectedFile ? [selectedFile.path] : [],
      selectedUnstagedPaths: activeFileSection === 'unstaged' && selectedFile ? [selectedFile.path] : [],
      selectedConflictPaths: activeFileSection === 'conflicts' && selectedFile ? [selectedFile.path] : [],
      stagedFileQuery: query, setStagedFileQuery: setQuery,
      handleStagedItemClick: (_event: unknown, file: GitFileStatus) => choose('staged', file),
      handleUnstagedItemClick: (_event: unknown, file: GitFileStatus) => choose('unstaged', file),
      handleConflictItemClick: (_event: unknown, file: GitFileStatus) => choose('conflicts', file)
    } as unknown as GitPageModel
    return <><section aria-label="staged"><GitStagedFiles g={g} /></section><section aria-label="unstaged"><GitUnstagedFiles g={g} /></section><GitConflictFiles g={g} /><button onClick={() => setFiles([])}>删除列表</button></>
  }
  render(<Fixture />)
  const count = (label: string) => screen.getByLabelText(label).textContent
  expect(count('已暂存文件位置')).toBe('0/2')
  fireEvent.click(document.querySelector('[aria-label=staged] [data-git-change-path="README.md"]')!)
  expect(count('已暂存文件位置')).toBe('1/2')
  expect(count('未暂存文件位置')).toBe('0/2')
  fireEvent.click(screen.getByRole('button', { name: '已暂存文件切换为树形视图' }))
  expect(count('已暂存文件位置')).toBe('2/2')
  fireEvent.click(screen.getByRole('button', { name: '搜索已暂存文件' }))
  fireEvent.change(screen.getByRole('textbox', { name: '搜索已暂存文件关键词' }), { target: { value: 'src' } })
  expect(count('已暂存文件位置')).toBe('0/1')
  fireEvent.click(document.querySelector('[aria-label=staged] [data-git-change-path="src/item.ts"]')!)
  expect(count('已暂存文件位置')).toBe('1/1')
  fireEvent.click(document.querySelector('[aria-label=unstaged] [data-git-change-path="new.md"]')!)
  expect(count('未暂存文件位置')).toBe('2/2')
  expect(count('已暂存文件位置')).toBe('0/1')
  fireEvent.click(screen.getByRole('option', { name: /second.md/ }))
  expect(count('冲突文件位置')).toBe('2/2')
  expect(count('未暂存文件位置')).toBe('0/2')
  fireEvent.click(screen.getByRole('button', { name: '删除列表' }))
  expect(count('已暂存文件位置')).toBe('0/0')
})
