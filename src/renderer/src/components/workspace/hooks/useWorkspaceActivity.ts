import { useFileChanges } from "@/components/workspace/hooks/file-changes"
import { createContext, useContext, useEffect, useRef, useState } from "react"

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

/** Formats date. */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Calculates level. */
function calculateLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

/** Provides the workspace activity hook. */
export function useWorkspaceActivityTracker(workspacePath: string) {
  const [store, setStore] = useState<WorkspaceActivityStore>({})
  const [loading, setLoading] = useState(true)
  const sessionKeyRef = useRef("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    sessionKeyRef.current = ""

    /** Loads load. */
    const load = async () => {
      if (!workspacePath) return
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspacePath))
      if (cancelled) return
      const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("")
      const key = `workspace-activity:${hash}`
      sessionKeyRef.current = key

      const saved = await window.electronAPI.getAppState<WorkspaceActivityStore>(key)
      if (cancelled) return

      const initial: WorkspaceActivityStore = {}
      try {
        // Scan nested notes too; saved records may predate edits made off the home screen.
        const scanList: Awaited<ReturnType<typeof window.electronAPI.readWorkspaceDirectory>> = []
        const pending = [workspacePath]
        while (pending.length) {
          const directory = pending.pop()!
          try {
            const entries = await window.electronAPI.readWorkspaceDirectory(workspacePath, directory)
            if (cancelled) return
            for (const entry of entries) {
              if (entry.type === "directory") {
                if (!entry.name.startsWith(".") && entry.name !== "node_modules") pending.push(entry.path)
              } else scanList.push(entry)
            }
          } catch {
            // One unreadable directory should not hide the rest of the workspace.
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

        // File timestamps are a lower bound, not additional edit events.
        for (const [date, record] of Object.entries(saved || {})) {
          const inferred = initial[date]
          initial[date] = { date, create: Math.max(record.create, inferred?.create || 0), update: Math.max(record.update, inferred?.update || 0), delete: record.delete }
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
    changes = changes.filter((change) => change.path.startsWith(workspacePath.replace(/[/\\]+$/, "") + "/"))
    if (loading || !sessionKeyRef.current || !changes.length) return
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

export const WorkspaceActivityContext = createContext<ReturnType<typeof useWorkspaceActivityTracker> | null>(null)

export function useWorkspaceActivity(_workspacePath: string) {
  const activity = useContext(WorkspaceActivityContext)
  if (!activity) throw new Error("Workspace activity requires its workspace provider")
  return activity
}
