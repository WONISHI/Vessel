import { toast } from 'sonner'

/** Copy in main so the clipboard watcher never captures the plaintext password. */
export function copyVaultPassword(id: string) {
  void window.electronAPI.vaultRequest('copy', { id }).catch(() => toast.error('复制密码失败'))
}
