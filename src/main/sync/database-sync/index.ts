import { deleteDatabaseData } from './delete-data'
import { requestLocalDatabaseDeletion } from '../../database/reset-local'
import { notifyDataDomainChanged, registerDataClient } from '../../database/data-domain'
import { loadSystemDomainDatabase } from '../../database/system-domain'
import { vaultDomains } from '../../vault/service'
import { app, BrowserWindow, type WebContents } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DatabaseDomain, DatabaseSyncConfig } from '@vessel/type/database-sync'
import { DatabaseSyncService } from './service'
let sharedService: DatabaseSyncService | undefined
let busy = false

/** A single process-wide login selects the data source for every application window. */
export function registerDatabaseSync(host: WebContents) {
  const directory = app.getPath('userData')
  if (!sharedService) {
    const deviceFile = join(directory, 'database-sync-device-id')
    const deviceId = existsSync(deviceFile) ? readFileSync(deviceFile, 'utf8').trim() : randomUUID()
    if (!existsSync(deviceFile)) writeFileSync(deviceFile, deviceId, { mode: 0o600 })
    // Remove the obsolete on-disk user connection. A user domain now lives only in process memory.
    void unlink(join(directory, 'database-sync.enc')).catch(error => { if (error.code !== 'ENOENT') console.error('无法移除旧用户域配置') })
    sharedService = new DatabaseSyncService(directory, deviceId, async () => {}, undefined, undefined, vaultDomains)
    const systemConfig = loadSystemDomainDatabase(join(app.isPackaged ? directory : app.getAppPath(), '.vessel-system-domain.local'))
    if (systemConfig) sharedService.setSystemConfig(systemConfig)
    app.once('will-quit', () => { void sharedService?.dispose() })
  }
  const service = sharedService
  const run = async <T>(action: () => Promise<T> | T, destination = "/", reauthenticated = false, synchronized = false): Promise<T> => {
    if (busy) throw new Error('正在处理数据库操作，请稍候')
    busy = true
    const previous = service.status().user?.id
    try {
      const result = await action()
      if (previous !== service.status().user?.id || (reauthenticated && !!service.status().user)) {
        notifyDataDomainChanged()
        for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('database-sync:source-changed', destination, synchronized)
      }
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '数据库操作失败'
      throw new Error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[连接信息已隐藏]').slice(0, 500))
    } finally { busy = false }
  }
  const handlers = {
    ready: () => { registerDataClient(host.id) },
    status: () => service.status(),
    connect: (config?: DatabaseSyncConfig, domain?: DatabaseDomain) => run(() => service.connect(config, domain), "/login?mode=register"),
    authenticate: (mode: 'login' | 'register', name: string, password: string) => run(() => service.authenticate(mode, name, password), "/", mode === 'login'),
    initialize: (importLocal: boolean) => run(() => service.initialize(importLocal), "/", false, importLocal === true),
    logout: () => run(() => service.logout(), "/login"),
    upload: () => run(() => service.upload()),
    syncLocal: () => run(() => service.syncLocal(), '/settings', true, true),
    deleteData: (scope: unknown, confirmation: unknown) => run(() => deleteDatabaseData(scope, confirmation, {
      configured: service.status().configured, deleteRemote: () => service.deleteRemoteData(), deleteLocal: () => requestLocalDatabaseDeletion(directory)
    })),
    disconnect: () => run(() => service.disconnect(), "/login")
  }
  for (const [name, action] of Object.entries(handlers)) host.ipc.handle(`database-sync:${name}`, (event, ...args: unknown[]) => {
    if (event.senderFrame !== host.mainFrame) throw new Error('不允许从子页面访问数据域')
    return (action as (...values: unknown[]) => unknown)(...args)
  })
}
