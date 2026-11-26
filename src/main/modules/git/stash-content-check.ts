import type { GitStashContentCheck, GitStashFile } from '@vessel/type/git'
import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { gitService, runGit } from './git-service'

/** Conservative, read-only comparison. Different content never implies a stash was not restored. */
export async function checkStashContent(cwd: string, hash: string): Promise<GitStashContentCheck> {
  const top = await runGit(['rev-parse', '--show-toplevel'], cwd)
  if (top.exitCode !== 0) throw new Error(top.stderr || '无法读取仓库')
  const root = await realpath(top.stdout.trim())
  const detail = await gitService.getStashDetail(root, hash)
  const unresolved = await runGit(['diff', '--name-only', '--diff-filter=U', '-z'], root)
  if (unresolved.exitCode !== 0) throw new Error(unresolved.stderr || '无法读取冲突状态')
  const conflicts = new Set(unresolved.stdout.split('\0').filter(Boolean))
  const fileMode = await runGit(['config', '--bool', 'core.filemode'], root)
  const safe = (path: string) => { const rel = relative(root, path); return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) }
  const inspect = async (file: GitStashFile): Promise<GitStashContentCheck['files'][number]> => {
    const result = (state: GitStashContentCheck['files'][number]['state'], reason?: string) => ({ path: file.path, state, ...(reason ? { reason } : {}) })
    if (conflicts.has(file.path) || file.oldPath && conflicts.has(file.oldPath)) return result('unknown', '当前文件存在未解决冲突')
    const path = join(root, file.path)
    if (!safe(path)) return result('unknown', '文件路径超出仓库范围')
    try {
      let entry: Awaited<ReturnType<typeof lstat>>
      try { entry = await lstat(path) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return result(file.status === 'D' ? 'same' : 'missing', file.status === 'D' ? '当前文件已删除' : '当前文件不存在')
        throw error
      }
      if (file.status === 'D') return result('different', '贮藏中已删除，当前仍存在')
      if (!entry.isFile() || entry.isSymbolicLink()) return result('unknown', '目录、符号链接或子模块需手动核对')
      if (!safe(await realpath(path))) return result('unknown', '文件实际位置超出仓库范围')
      const target = file.source === 'untracked' ? `${detail.hash}^3` : file.source === 'index' ? `${detail.hash}^2` : detail.hash
      const saved = await runGit(['--literal-pathspecs', 'ls-tree', '--full-tree', '-z', target, '--', file.path], root)
      const blob = saved.exitCode === 0 ? saved.stdout.match(/^(\d+) blob ([a-f\d]+)\t/) : null
      if (!blob) return result('unknown', '无法读取贮藏文件对象')
      const current = await runGit(['hash-object', '--no-filters', '--', file.path], root)
      if (current.exitCode !== 0) return result('unknown', '无法读取当前文件')
      if (current.stdout.trim() !== blob[2]) return result('different', '内容不同或存在后续修改，需进一步核对')
      if (process.platform !== 'win32' && fileMode.stdout.trim() !== 'false' && (blob[1] === '100755') !== !!(entry.mode & 0o111)) return result('different', '文件权限不同')
      if (file.status === 'R' && file.oldPath) {
        const old = join(root, file.oldPath)
        if (!safe(old)) return result('unknown', '原路径超出仓库范围')
        try { await lstat(old); return result('different', '重命名前的旧路径仍存在') }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      }
      return result('same', '当前文件与贮藏保存内容一致')
    } catch (error) { return result('unknown', error instanceof Error ? error.message : String(error)) }
  }
  const files: GitStashContentCheck['files'] = new Array(detail.files.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, detail.files.length) }, async () => {
    while (next < detail.files.length) { const index = next++; files[index] = await inspect(detail.files[index]) }
  }))
  return { hash: detail.hash, checkedAt: new Date().toISOString(), files }
}
