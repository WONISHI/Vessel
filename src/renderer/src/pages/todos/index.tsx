import { useEffect, useState } from "react"
import Layout from "@/layout"
import TodoAside from "./components/layout-aside"
import TodoMain from "./components/layout-main"
import { dateKey, fromKey } from "./calendar"
import type { Todo } from "../../../../shared/todos"
export default function TodosPage() {
  const [selected, setSelected] = useState(() => dateKey(new Date()))
  const [month, setMonth] = useState(() => fromKey(dateKey(new Date())))
  const [todos, setTodos] = useState<Todo[]>([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    window.electronAPI
      .listTodos()
      .then((value) => {
        if (!cancelled) setTodos(value)
      })
      .catch((error) => {
        if (!cancelled) setError(String(error))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const select = (date: string) => {
    setSelected(date)
    setMonth(fromKey(date))
  }
  const mutate = async (action: () => Promise<Todo[]>) => {
    if (busy) return false
    setBusy(true)
    setError("")
    try {
      setTodos(await action())
      return true
    } catch (error) {
      setError(String(error))
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <Layout aside={null}>
      <TodoAside todos={todos} selected={selected} onSelect={select}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {error && (
          <p
            role="alert"
            className="bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {busy && (
          <p
            role="status"
            className="px-6 pt-2 text-xs text-stone-400"
          >
            正在同步待办…
          </p>
        )}
        <TodoMain
          todos={todos}
          selected={selected}
          month={month}
          onSelect={select}
          onMonth={setMonth}
          busy={busy}
          onAdd={(title) => mutate(() => window.electronAPI.addTodo(selected, title))}
          onComplete={(todo) => void mutate(() => window.electronAPI.completeTodo(todo.id, !todo.completed))}
          onDelete={(id) => void mutate(() => window.electronAPI.deleteTodo(id))}
        />
      </div>
      </TodoAside>
    </Layout>
  )
}
