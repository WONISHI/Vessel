import Database from 'better-sqlite3'
import { AsyncLocalStorage } from 'node:async_hooks'
import { resolve } from 'node:path'

export type DomainConnections = Map<string, Database.Database>
export interface RemoteDataBackend {
  readState?(key: string): Promise<unknown>
  run<T>(databases: string[], action: () => T | Promise<T>): Promise<T>
  close(): Promise<void>
}
const context = new AsyncLocalStorage<DomainConnections>()
const connections = new Map<string, Database.Database>()
let backend: RemoteDataBackend | undefined
let switching = false
const pending = new Set<Promise<unknown>>()

/** Synchronous business SQL runs in memory while PostgreSQL owns persistence. */
export function createDomainDatabase(path: string, options?: Database.Options): Database.Database {
  const local = new Database(path, options), key = resolve(path)
  if (!options?.readonly) connections.set(key, local)
  return new Proxy(local, {
    get(target, property) {
      if (property === 'close') return () => { if (connections.get(key) === local) connections.delete(key); if (local.open) local.close() }
      const current = context.getStore()
      const selected = current ? current.get(key) : backend ? undefined : target
      if (!selected) throw new Error('数据域上下文无效，已阻止写入本地数据库')
      const value = Reflect.get(selected, property, selected)
      return typeof value === 'function' ? value.bind(selected) : value
    }
  })
}
export const domainConnection = (path: string) => connections.get(resolve(path))
export function inRemoteMemory<T>(value: DomainConnections, action: () => T): T { return context.run(value, action) }
export function isRemoteDataActive() { return !!backend }
export function runDataOperation<T>(databases: string[], action: () => T | Promise<T>): Promise<T> {
  if (switching || held) return Promise.reject(new Error('正在切换数据域，请稍候'))
  if (context.getStore()) return Promise.resolve().then(action)
  const selected = backend
  const operation = selected ? selected.run(databases, action) : Promise.resolve().then(action)
  pending.add(operation)
  void operation.finally(() => pending.delete(operation)).catch(() => {})
  return operation
}

/** Read one remote setting directly; participate in the same domain-switch drain barrier. */
export function readDataState<T>(key: string, local: () => T | Promise<T>): Promise<T> {
  if (switching || held) return Promise.reject(new Error('正在切换数据域，请稍候'))
  if (context.getStore() || !backend?.readState) return runDataOperation(['vessel.db'], local)
  const operation = backend.readState(key) as Promise<T>
  pending.add(operation)
  void operation.finally(() => pending.delete(operation)).catch(() => {})
  return operation
}
/** Drain old-domain work before publishing the new domain; failures never select local. */
export async function switchDataDomain(next?: RemoteDataBackend) {
  if (switching) throw new Error('正在切换数据域，请稍候')
  switching = true
  try {
    await Promise.allSettled([...pending])
    const previous = backend
    backend = next
    if (previous && previous !== next) await previous.close()
  } finally { switching = false }
}

let revision = 0
let held = false
const clients = new Map<number, number>()
const listeners = new Set<() => void>()
export function onDataDomainChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function notifyDataDomainChanged() { revision++; held = true; for (const listener of listeners) listener() }
export function registerDataClient(id: number) { clients.set(id, revision); held = false }
export function assertDataClient(id?: number) { if (id !== undefined && revision > 0 && clients.get(id) !== revision) throw new Error('数据域已切换，请等待页面重新加载') }
export function dataDomainUnavailable() { return switching || held }
export function localDatabaseLifecycle<T>(action: () => T): T { return context.run(connections, action) }

export function drainDataOperations(): Promise<void> | null {
  return pending.size ? Promise.all([...pending]).then(() => {}) : null
}
