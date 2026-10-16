import type { TodosAPI } from "@vessel/type"
import { ipcRenderer } from "electron"
export const todosAPI: TodosAPI = {
  /** Lists todos. */
  listTodos: () => ipcRenderer.invoke("todos:list"),

  /** Adds todo. */
  addTodo: (date, title) => ipcRenderer.invoke("todos:add", date, title),

  /** Performs the complete todo operation. */
  completeTodo: (id, done) => ipcRenderer.invoke("todos:complete", id, done),

  /** Deletes todo. */
  deleteTodo: (id) => ipcRenderer.invoke("todos:delete", id)
}
