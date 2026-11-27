import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { toast } from '@/components/ui/sonner'
import { shortcuts } from './components/index-shared'

export type BrowserBookmark = { url: string; title: string; favicon?: string }
const key = 'browser-bookmarks'
const migrationKey = 'browser-bookmarks-database-migrated-v1'
const valid = (value: unknown): BrowserBookmark[] => Array.isArray(value) ? value.filter(item => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url) && typeof item.title === 'string') : []
const snapshot = (items: BrowserBookmark[]) => JSON.stringify(items.map(({ url, title }) => ({ url, title })))

/** The active database is authoritative; browser storage is only a legacy local migration source. */
export function useBrowserBookmarks() {
  const [bookmarks, update] = useState<BrowserBookmark[]>([])
  const [ready, setReady] = useState(false)
  const initialized = useRef(false), persisted = useRef(''), pending = useRef(0)
  const migratingLocal = useRef(false)
  useEffect(() => {
    let active = true
    const api = window.electronAPI
    const off = api.onBrowserBookmarksUpdated?.(items => {
      if (!active || !initialized.current || pending.current) return
      const next = valid(items)
      persisted.current = snapshot(next)
      update(next)
    })
    void Promise.resolve().then(() => Promise.all([api.getBrowserBookmarks(), api.databaseSync?.status()])).then(([saved, domain]) => {
      if (!active) return
      const stored = valid(saved)
      let next = stored
      if (domain?.source !== 'remote') {
        let cached: unknown
        let migrated = false
        try { migrated = localStorage.getItem(migrationKey) === 'true'; cached = JSON.parse(localStorage.getItem(key) || 'null') } catch { /* Ignore malformed legacy caches. */ }
        if (!migrated) {
          const merged = new Map(stored.map(item => [item.url, item]))
          const legacy = Array.isArray(cached) ? valid(cached) : stored.length ? [] : shortcuts
          for (const item of legacy) if (!merged.has(item.url)) merged.set(item.url, item)
          next = [...merged.values()]
          migratingLocal.current = true
        }
      }
      persisted.current = snapshot(stored)
      initialized.current = true
      update(next)
      setReady(true)
    }).catch(error => { if (active) toast.error('读取书签失败，请重试', { description: String(error) }) })
    return () => { active = false; initialized.current = false; off?.() }
  }, [])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(key, JSON.stringify(bookmarks)) } catch { /* The database remains authoritative. */ }
    const value = snapshot(bookmarks)
    const migrated = () => {
      if (!migratingLocal.current) return
      try { localStorage.setItem(migrationKey, 'true'); migratingLocal.current = false } catch { /* Retry migration on a later launch. */ }
    }
    if (value === persisted.current) { migrated(); return }
    pending.current++
    void window.electronAPI.syncBrowserBookmarks(bookmarks).then(() => { persisted.current = value; migrated() })
      .catch(error => toast.error('保存书签失败，请重试', { description: String(error) }))
      .finally(() => { pending.current-- })
  }, [bookmarks, ready])
  const setBookmarks = useCallback((action: SetStateAction<BrowserBookmark[]>) => {
    if (initialized.current) update(action)
  }, [])
  const removeBookmark = useCallback((url: string) => setBookmarks(items => items.filter(item => item.url !== url)), [setBookmarks])
  const resetBookmarks = useCallback(() => setBookmarks(shortcuts), [setBookmarks])
  return { bookmarks, setBookmarks, removeBookmark, resetBookmarks, bookmarksReady: ready }
}
