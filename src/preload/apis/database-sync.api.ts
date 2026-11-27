import { ipcRenderer } from 'electron'
import type { DatabaseSyncAPI } from '@vessel/type/database-sync'
export const databaseSyncAPI: DatabaseSyncAPI = {
  databaseSync: {
    ready: () => ipcRenderer.invoke('database-sync:ready'),
    onSourceChanged: callback => {
      const listener = (_event: Electron.IpcRendererEvent, destination?: string, synchronized?: boolean) => callback(destination, synchronized)
      ipcRenderer.on('database-sync:source-changed', listener)
      return () => ipcRenderer.removeListener('database-sync:source-changed', listener)
    },
    status: () => ipcRenderer.invoke('database-sync:status'),
    connect: (config, domain) => ipcRenderer.invoke('database-sync:connect', config, domain),
    authenticate: (mode, name, password) => ipcRenderer.invoke('database-sync:authenticate', mode, name, password),
    initialize: importLocal => ipcRenderer.invoke('database-sync:initialize', importLocal),
    logout: () => ipcRenderer.invoke('database-sync:logout'),
    upload: () => ipcRenderer.invoke('database-sync:upload'),
    syncLocal: () => ipcRenderer.invoke('database-sync:syncLocal'),
    disconnect: () => ipcRenderer.invoke('database-sync:disconnect'),
    deleteData: (scope, confirmation) => ipcRenderer.invoke('database-sync:deleteData', scope, confirmation)
  }
}
