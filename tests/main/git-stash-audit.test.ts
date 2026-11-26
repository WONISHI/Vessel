import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { GitService } from '@main/modules/git/git-service'
import { checkStashContent } from '@main/modules/git/stash-content-check'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'vessel-stash-audit-')); roots.push(root)
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-b', 'main', '--quiet'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.test'); git('config', 'commit.gpgSign', 'false'); git('config', 'core.hooksPath', '/dev/null')
  await writeFile(join(root, 'file.txt'), 'base\n'); await writeFile(join(root, 'delete.txt'), 'delete me\n')
  git('add', '.'); git('commit', '--quiet', '-m', 'base')
  return { root, git, service: new GitService(), write: (name: string, content: string) => writeFile(join(root, name), content) }
}

it('persists successful apply/pop history by hash across ordinal shifts and service restarts', async () => {
  const { root, git, service, write } = await fixture()
  const journal = join(root, '.git', 'application-test-history.json')
  service.configureStashRestoreHistory(journal)
  await write('file.txt', 'saved\n'); await service.stashSave(root, 'original stash')
  const first = (await service.getStashes(root))[0]
  await service.stashApply(root, 0, first.hash)
  expect((await service.getStashes(root))[0].lastRestore?.outcome).toBe('applied')
  await service.stashSave(root, 'newer stash')
  expect((await service.getStashes(root)).find(entry => entry.hash === first.hash)?.index).toBe(1)
  const restarted = new GitService(); restarted.configureStashRestoreHistory(journal)
  expect(await restarted.getStashRestoreHistory(root)).toMatchObject([{ hash: first.hash, name: 'original stash', branch: 'main', action: 'apply', outcome: 'applied', dropped: false }])
  await restarted.stashPop(root, 1, first.hash)
  expect(git('stash', 'list')).not.toContain('original stash')
  expect(await restarted.getStashRestoreHistory(root)).toMatchObject([{ hash: first.hash, index: 1, action: 'pop', dropped: true }, { hash: first.hash, action: 'apply', dropped: false }])
  expect(await readFile(join(root, 'file.txt'), 'utf8')).toBe('saved\n')
})

it('records a conflicted restore distinctly and never records a preflight rejection as restored', async () => {
  const { root, git, service, write } = await fixture()
  await write('file.txt', 'saved\n'); await service.stashSave(root, 'conflict')
  await write('file.txt', 'dirty\n')
  await expect(service.stashApply(root)).rejects.toThrow('本地修改')
  expect(await service.getStashRestoreHistory(root)).toEqual([])
  git('add', 'file.txt'); git('commit', '--quiet', '-m', 'current')
  expect(await service.stashPop(root)).toMatchObject({ dropped: false, conflicts: ['file.txt'] })
  expect(await service.getStashRestoreHistory(root)).toMatchObject([{ outcome: 'conflicts', dropped: false, conflicts: ['file.txt'] }])
  const hash = (await service.getStashes(root))[0].hash!
  expect((await checkStashContent(root, hash)).files.find(file => file.path === 'file.txt')?.state).toBe('unknown')
})

it('checks tracked/untracked/deleted contents without applying anything, and treats later edits as different rather than unrestored', async () => {
  const { root, git, service, write } = await fixture()
  await write('file.txt', 'saved\n'); await write('new.txt', 'new\n'); await rm(join(root, 'delete.txt'))
  await service.stashSave(root, 'compare')
  const hash = (await service.getStashes(root))[0].hash!
  const before = git('status', '--porcelain=v1', '--untracked-files=all')
  const index = git('write-tree')
  const initial = await checkStashContent(root, hash)
  expect(initial.files.find(file => file.path === 'file.txt')?.state).toBe('different')
  expect(initial.files.find(file => file.path === 'new.txt')?.state).toBe('missing')
  expect(git('status', '--porcelain=v1', '--untracked-files=all')).toBe(before)
  expect(git('write-tree')).toBe(index)
  expect(await service.getStashRestoreHistory(root)).toEqual([])
  await service.stashApply(root, 0, hash)
  expect((await checkStashContent(root, hash)).files.every(file => file.state === 'same')).toBe(true)
  await write('file.txt', 'saved\nsubsequent edits\n')
  expect((await checkStashContent(root, hash)).files.find(file => file.path === 'file.txt')?.state).toBe('different')
  expect((await service.getStashRestoreHistory(root))[0].outcome).toBe('applied')
})

it('reports a journal failure without reporting the successful restore itself as failed', async () => {
  const { root, service, write } = await fixture()
  await write('file.txt', 'saved\n'); await service.stashSave(root, 'journal failure')
  service.configureStashRestoreHistory(root) // An existing directory cannot be read as the audit JSON file.
  const result = await service.stashApply(root)
  expect(result.conflicts).toEqual([])
  expect(result.historyWarning).toContain('保存恢复记录失败')
  expect(await readFile(join(root, 'file.txt'), 'utf8')).toBe('saved\n')
})

it('does not invent historical records for a manual Git restore even when all saved content matches', async () => {
  const { root, git, service, write } = await fixture()
  await write('file.txt', 'manually restored\n'); await service.stashSave(root, 'manual')
  const hash = (await service.getStashes(root))[0].hash!
  git('stash', 'apply', hash)
  expect((await checkStashContent(root, hash)).files.every(file => file.state === 'same')).toBe(true)
  expect(await service.getStashRestoreHistory(root)).toEqual([])
})
