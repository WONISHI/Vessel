import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { LayoutPreferencesStore } from './layout-preferences-store'

export function registerLayoutPreferences() {
  const store = new LayoutPreferencesStore(join(app.getPath('userData'), 'state', 'layout-preferences.json'))
  const authorize = (event: IpcMainInvokeEvent) => {
    if (event.sender.getType() !== 'window' || event.senderFrame !== event.sender.mainFrame) throw new Error('布局配置来源无效')
  }
  ipcMain.handle('layout-preferences:get', (event, legacy: unknown) => { authorize(event); return store.get(legacy) })
  ipcMain.handle('layout-preferences:set', (event, patch: unknown) => {
    authorize(event)
    const value = store.set(patch)
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('layout-preferences:changed', value)
    return value
  })
}
