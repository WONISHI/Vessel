import { useEffect, useRef } from 'react'

/** Reveal the restored/current row once, without fighting manual scroll on background refreshes. */
export function useGitSelectionReveal(repo: string, path: string | undefined, active: boolean, ready: boolean) {
 const root = useRef<HTMLDivElement>(null)
 useEffect(() => {
  if (!active || !ready || !path) return
  const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-git-primary-file="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
  return () => cancelAnimationFrame(frame)
 }, [repo, path, active, ready])
 return root
}
