let worker: Worker | undefined
let running = false

/** Local bundled PaddleOCR models, processed off the UI thread. */
export async function recognizeImage(src: string): Promise<string> {
  if (running) throw new Error('正在识别，请稍候')
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(src) || src.length > 40 * 1024 * 1024) throw new Error('请选择 30MB 以内的 PNG、JPEG 或 WebP 图片')
  running = true
  try {
    worker ??= new Worker(new URL('./image-ocr.worker.ts', import.meta.url), { type: 'module' })
    const current = worker
    return await new Promise<string>((resolve, reject) => {
      const finish = () => { clearTimeout(timeout); current.onmessage = null; current.onerror = null }
      const fail = (message: string) => { finish(); current.terminate(); worker = undefined; reject(new Error(message)) }
      const timeout = setTimeout(() => fail('识别超时，请缩小图片后重试'), 120_000)
      current.onerror = event => fail(event.message || 'OCR 引擎加载失败')
      current.onmessage = (event: MessageEvent<{ text?: string; error?: string }>) => {
        finish()
        if (event.data.error) reject(new Error(event.data.error))
        else resolve(event.data.text ?? '')
      }
      current.postMessage({ src, assets: new URL('ocr/', document.baseURI).href })
    })
  } finally { running = false }
}
