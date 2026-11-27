import { useEffect, type RefObject } from 'react'

const interval = 60_000
const attempts = new Map<string, number>()
const pending = new Set<string>()

/** Update remote refs without blocking local status or changing the worktree. */
export function useGitAutoFetch(repoPath: string, isRepo: boolean | null, refresh: (silent?: boolean) => Promise<void>, remotePending: RefObject<boolean>) {
  useEffect(() => {
    if (!repoPath || !isRepo) return
    let disposed = false
    const fetch = async () => {
      if (disposed || document.visibilityState === 'hidden' || remotePending.current || pending.has(repoPath)) return
      const previous = attempts.get(repoPath)
      if (previous !== undefined && Date.now() - previous < interval) return
      attempts.set(repoPath, Date.now())
      pending.add(repoPath)
      try {
        await window.electronAPI.git.fetch(repoPath, undefined, { all: true, prune: false, tags: false, background: true })
        if (!disposed) await refresh(true)
      } catch { /* Offline or missing credentials: retain cached counts; manual fetch can request authentication. */ }
      finally { pending.delete(repoPath) }
    }
    const update = () => { void fetch() }
    update()
    const timer = setInterval(update, interval)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [repoPath, isRepo, refresh, remotePending])
}
