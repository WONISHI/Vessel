import { realpath, writeFile, stat } from 'node:fs/promises'
import { relative, isAbsolute, sep, join } from 'node:path'
import { nativeImage, session } from 'electron'
export type ImageImport = { bytes?: Uint8Array; url?: string }
const limit = 30 * 1024 * 1024
/** Import attachments atomically into the vault root; never overwrite a same-second paste. */
export async function saveObsidianImage(root: string, documentPath: string, source: ImageImport) {
  const base = await realpath(root), document = await realpath(documentPath)
  const offset = relative(base, document)
  if (!offset || offset === '..' || offset.startsWith('..'+sep) || isAbsolute(offset) || !(await stat(document)).isFile()) throw new Error('文档不在工作区')
  let bytes: Buffer, extension = 'png'
  if (source.url) {
    const remote = await fetchRemoteImage(source.url)
    bytes = remote.bytes; extension = remote.extension
  } else {
    if (!source.bytes?.length || source.bytes.length > limit) throw new Error('图片内容为空或超过 30 MB')
    const image = nativeImage.createFromBuffer(Buffer.from(source.bytes))
    if (image.isEmpty()) throw new Error('无法读取剪贴板图片')
    bytes = image.toPNG()
  }
  if (!bytes.length || bytes.length > limit) throw new Error('图片内容为空或超过 30 MB')
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2,'0')
  for (let attempt = 0; attempt < 3600; attempt++) {
    const stamp = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    const name = `Pasted image ${stamp}.${extension}`, path = join(base,name)
    try { await writeFile(path,bytes,{flag:'wx'}); return { name, path, reference: `![[${name}]]` } }
    catch(error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; date.setSeconds(date.getSeconds()+1) }
  }
  throw new Error('图片文件名冲突，请稍后再试')
}

export async function fetchRemoteImage(address: string) {
    const url = new URL(address)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 HTTP 或 HTTPS 图片')
    const response = await session.fromPartition('persist:vessel-browser').fetch(url.href, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`)
    if (Number(response.headers.get('content-length')) > limit) throw new Error('图片超过 30 MB')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('图片内容为空')
    const chunks: Uint8Array[] = []; let size = 0
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('图片超过 30 MB'); chunks.push(value) }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    const bytes = Buffer.concat(chunks)
    let extension: string
    const header = bytes.subarray(0, 1000).toString()
    if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension = 'png'
    else if (bytes[0] === 255 && bytes[1] === 216) extension = 'jpg'
    else if (/^GIF8[79]a/.test(header)) extension = 'gif'
    else if (header.startsWith('RIFF') && header.slice(8,12) === 'WEBP') extension = 'webp'
    else if (/^(?:\s*<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg[\s>]/i.test(header)) extension = 'svg'
    else if (header.slice(4,8) === 'ftyp' && /avif|avis/.test(header.slice(8,32))) extension = 'avif'
    else throw new Error('下载内容不是支持的图片')
    return { bytes, extension }
}
