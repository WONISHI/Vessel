import { clipboard } from 'electron'
import { createHash } from 'node:crypto'

let digest = ''
let timer: ReturnType<typeof setTimeout> | undefined
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
/** Keep password copies out of Vessel's local and remote clipboard histories. */
export function isVaultClipboardSecret(value: string) { return !!digest && hash(value) === digest }
export function clearVaultClipboardSecret() {
  clearTimeout(timer)
  if (digest && isVaultClipboardSecret(clipboard.readText())) clipboard.clear()
  digest = ''
}
export function copyVaultSecret(value: string) {
  clearTimeout(timer)
  digest = hash(value)
  clipboard.writeText(value)
  timer = setTimeout(() => {
    // Never erase something the user copied after this password.
    clearVaultClipboardSecret()
  }, 30000)
  timer.unref()
}
