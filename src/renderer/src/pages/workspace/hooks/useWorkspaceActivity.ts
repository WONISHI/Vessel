import { useEffect, useRef, useState } from "react"
import { useFileChanges } from "./file-changes"

export type DayActivity = {
  date: string // "YYYY-MM-DD"
  create: number
  update: number
  delete: number
}

export type WorkspaceActivityStore = Record<string, DayActivity>

export type CalendarActivityItem = {
  date: string
  count: number
  level: number
}

export type MonthActivityItem = {
  date: string
  fullDate: string
  修改: number
  新建: number
  删除: number
  总计: number
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function calculateLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

export function useWorkspaceActivity(workspacePath: string) {
  const [store, setStore] = useState<WorkspaceActivityStore>({})
  const [loading, setLoading] = useState(true)
  const sessionKeyRef = useRef("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const load = async () => {
      if (!workspacePath) return
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspacePath))
      if (cancelled) return
      const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("")
      const key = `workspace-activity:${hash}`
      sessionKeyRef.current = key

      const saved = await window.electronAPI.getAppState<WorkspaceActivityStore>(key)
      if (cancelled) return

      if (saved && typeof saved === "object" && Object.keys(saved).length > 0) {
        setStore(saved)
        setLoading(false)
        return
      }

      // Initial populate from workspace directory file stats if no SQLite record yet
      const initial: WorkspaceActivityStore = {}
      try {
        const rootEntries = await window.electronAPI.readWorkspaceDirectory(workspacePath, workspacePath)
        if (cancelled) return

        const scanList = [...rootEntries]
        // Also scan first level directories for more complete historical view
        for (const entry of rootEntries) {
          if (entry.type === "directory" && !entry.name.startsWith(".")) {
            try {
              const children = await window.electronAPI.readWorkspaceDirectory(workspacePath, entry.path)
              scanList.push(...children)
            } catch {}
          }
        }

        const now = Date.now()
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000

        for (const file of scanList) {
          if (file.type === "directory") continue
          if (file.mtime && file.mtime > oneYearAgo) {
            const dStr = formatDate(new Date(file.mtime))
            if (!initial[dStr]) initial[dStr] = { date: dStr, create: 0, update: 0, delete: 0 }
            initial[dStr].update++
          }
          if (file.ctime && file.ctime > oneYearAgo) {
            const dStr = formatDate(new Date(file.ctime))
            if (!initial[dStr]) initial[dStr] = { date: dStr, create: 0, update: 0, delete: 0 }
            initial[dStr].create++
          }
        }

        // If completely empty, seed today's entry
        const todayStr = formatDate(new Date())
        if (!initial[todayStr]) {
          initial[todayStr] = { date: todayStr, create: 0, update: 0, delete: 0 }
        }

        await window.electronAPI.setAppState(key, initial)
        if (!cancelled) {
          setStore(initial)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          const todayStr = formatDate(new Date())
          initial[todayStr] = { date: todayStr, create: 0, update: 0, delete: 0 }
          setStore(initial)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [workspacePath])

  // Listen to file changes in real time and persist to SQLite
  useFileChanges((changes) => {
    if (!sessionKeyRef.current || !changes.length) return
    const today = formatDate(new Date())

    setStore((prev) => {
      const currentToday = prev[today] || { date: today, create: 0, update: 0, delete: 0 }
      let create = currentToday.create
      let update = currentToday.update
      let del = currentToday.delete

      for (const change of changes) {
        if (change.type === "create") create++
        else if (change.type === "update") update++
        else if (change.type === "delete") del++
      }

      const updated = {
        ...prev,
        [today]: { date: today, create, update, delete: del }
      }
      void window.electronAPI.setAppState(sessionKeyRef.current, updated).catch(console.error)
      return updated
    })
  })

  // Prepare 365 days of Activity Calendar data
  const today = new Date()
  const calendarData: CalendarActivityItem[] = []
  const activityMap = new Map<string, DayActivity>()

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const dateStr = formatDate(d)
    const record = store[dateStr] || { date: dateStr, create: 0, update: 0, delete: 0 }
    activityMap.set(dateStr, record)
    const count = record.create + record.update + record.delete
    calendarData.push({
      date: dateStr,
      count,
      level: calculateLevel(count)
    })
  }

  // Prepare 30 days of monthly Line Chart data
  const monthlyData: MonthActivityItem[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const dateStr = formatDate(d)
    const shortDate = `${d.getMonth() + 1}/${d.getDate()}`
    const record = store[dateStr] || { date: dateStr, create: 0, update: 0, delete: 0 }
    monthlyData.push({
      date: shortDate,
      fullDate: dateStr,
      修改: record.update,
      新建: record.create,
      删除: record.delete,
      总计: record.update + record.create + record.delete
    })
  }

  return {
    calendarData,
    activityMap,
    monthlyData,
    loading
  }
}
