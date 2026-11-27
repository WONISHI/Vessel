import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { GitService } from '@main/modules/git/git-service'

it('updates ahead/behind from a local remote without changing HEAD or working files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vessel-auto-fetch-'))
  const remote = join(root, 'remote.git'), local = join(root, 'local'), peer = join(root, 'peer')
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()
  const identity = (cwd: string) => { git(cwd, 'config', 'user.name', 'Test'); git(cwd, 'config', 'user.email', 'test@example.com') }
  try {
    git(root, 'init', '--bare', '--initial-branch=main', remote)
    git(root, 'clone', remote, local)
    identity(local)
    await writeFile(join(local, 'seed.txt'), 'seed')
    git(local, 'add', '.'); git(local, 'commit', '-m', 'seed'); git(local, 'push', '-u', 'origin', 'main')
    git(root, 'clone', remote, peer)
    identity(peer)
    await writeFile(join(peer, 'remote.txt'), 'remote update')
    git(peer, 'add', '.'); git(peer, 'commit', '-m', 'remote update'); git(peer, 'push')
    const service = new GitService(), head = git(local, 'rev-parse', 'HEAD')
    expect((await service.getStatus(local)).behind).toBe(0)
    await writeFile(join(local, 'draft.txt'), 'keep my draft')
    await service.fetch(local, undefined, { all: true, prune: false, tags: false, background: true })
    expect(await service.getStatus(local)).toMatchObject({ ahead: 0, behind: 1, upstream: 'origin/main' })
    expect(git(local, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(local, 'status', '--porcelain')).toBe('?? draft.txt')
  } finally { await rm(root, { recursive: true, force: true }) }
})
