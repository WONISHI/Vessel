import { app, ipcMain, type WebContents } from 'electron'
import { JsonShareService } from './json-share-service'

/** Stop sharing both on window destruction and before application shutdown (including tray apps). */
function documentScope(value: unknown): string {
  if (value === undefined) return 'default'
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error('JSON 文档标识无效')
  return value
}

export function registerJsonSharing(): () => void {
  const service = new JsonShareService()
  const owners = new Map<WebContents, () => void>()
  const stopAll = () => service.dispose()
  app.on('before-quit', stopAll)
  ipcMain.handle('json-share:start', (event, content: unknown, scope: unknown) => {
    const document = documentScope(scope)
    const owner = event.sender
    const id = owner.id
    if (!owners.has(owner)) {
      const closed = () => { service.stopOwner(id); owners.delete(owner) }
      owners.set(owner, closed)
      owner.once('destroyed', closed)
    }
    return service.start(id, content, document)
  })
  ipcMain.handle('json-share:status', (event, scope: unknown) => service.status(event.sender.id, documentScope(scope)))
  ipcMain.handle('json-share:stop', (event, scope: unknown) => service.stop(event.sender.id, documentScope(scope)))
  return () => {
    app.removeListener('before-quit', stopAll)
    for (const [owner, closed] of owners) owner.removeListener('destroyed', closed)
    owners.clear()
    service.dispose()
    for (const channel of ['json-share:start', 'json-share:status', 'json-share:stop']) ipcMain.removeHandler(channel)
  }
}
