import type { editor } from 'monaco-editor'
const owners = new Map<editor.ITextModel, Set<editor.IStandaloneCodeEditor>>()

/** Split editors can share a model: dispose it only after its final owner is gone. */
export function retainCodeModel(instance: editor.IStandaloneCodeEditor) {
  const model = instance.getModel()
  if (!model) return () => {}
  let users = owners.get(model)
  if (!users) { users = new Set(); owners.set(model, users) }
  users.add(instance)
  return () => {
    users!.delete(instance)
    queueMicrotask(() => {
      if (users!.size || owners.get(model) !== users) return
      owners.delete(model)
      if (!model.isDisposed()) model.dispose()
    })
  }
}
