import { expect, it } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TodoStore } from "../../src/main/modules/todos/store"
it("starts empty and persists dated todos and completion across reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "vessel-todos-")),
    path = join(directory, "todos.sqlite")
  let store = new TodoStore(path)
  try {
    expect(store.list()).toEqual([])
    const [todo] = store.add("2026-09-27", "  阅读  ")
    store.add("2026-10-01", "出行")
    store.complete(todo.id, true)
    store.close()
    store = new TodoStore(path)
    expect(store.list()).toEqual([{ ...todo, title: "阅读", completed: true }, expect.objectContaining({ date: "2026-10-01", title: "出行" })])
    expect(() => store.add("2026-02-30", "无效")).toThrow()
    expect(() => store.add("2026-09-27", " ")).toThrow()
    expect(() => store.complete(-1, true)).toThrow()
    store.remove(todo.id)
    expect(store.list()).toHaveLength(1)
  } finally {
    store.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
