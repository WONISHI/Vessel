export interface Todo {
  id: number
  date: string
  title: string
  completed: boolean
}
export interface TodosAPI {
  listTodos: () => Promise<Todo[]>
  addTodo: (date: string, title: string) => Promise<Todo[]>
  completeTodo: (id: number, completed: boolean) => Promise<Todo[]>
  deleteTodo: (id: number) => Promise<Todo[]>
}
