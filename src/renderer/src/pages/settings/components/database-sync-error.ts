import { toast } from '@/components/ui/sonner'

export function showDatabaseSyncError(reason: unknown) {
  const detail = reason instanceof Error ? reason.message : String(reason)
  const message = detail.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(?:Error:\s*)+/, '').trim()
  toast.error(message || '数据库操作失败，请重试')
}
