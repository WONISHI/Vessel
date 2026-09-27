import { ipcRenderer } from "electron"
import type { TodosAPI } from "../../shared/todos"
export const todosAPI: TodosAPI = {
  listTodos: () => ipcRenderer.invoke("todos:list"),
  addTodo: (date, title) => ipcRenderer.invoke("todos:add", date, title),
  completeTodo: (id, done) => ipcRenderer.invoke("todos:complete", id, done),
  deleteTodo: (id) => ipcRenderer.invoke("todos:delete", id)
}
