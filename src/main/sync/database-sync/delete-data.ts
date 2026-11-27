import { validateDatabaseDeletion } from '@vessel/type/database-sync'
/** Remote deletion must succeed before local deletion is even scheduled. */
export async function deleteDatabaseData(scope: unknown, confirmation: unknown, operations: { configured: boolean; deleteRemote: () => Promise<void>; deleteLocal: () => void }) {
  const target = validateDatabaseDeletion(scope, confirmation)
  let remoteDeleted = false
  if (target !== 'local') {
    if (!operations.configured) throw new Error('尚未配置数据库同步')
    await operations.deleteRemote()
    remoteDeleted = true
  }
  if (target !== 'remote') {
    try { operations.deleteLocal() }
    catch (error) {
      if (remoteDeleted) throw new Error('远程数据已删除，但本地删除未能安排，请重试本地删除：' + (error instanceof Error ? error.message : String(error)))
      throw error
    }
  }
  return { restarting: target !== 'remote', remoteDeleted }
}
