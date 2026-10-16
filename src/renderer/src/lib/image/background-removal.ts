let worker: Worker | undefined
let running = false

/** Keep the library's generated ndarray functions and CPU inference off the UI thread. */
export async function removeImageBackground(image: Blob, publicPath: string, progress: (text: string) => void): Promise<Blob> {
  if (running) throw new Error("正在处理图片，请稍候")
  running = true
  try {
    worker ??= new Worker(new URL("./background-removal.worker.ts", import.meta.url), { type: "module" })
    const current = worker
    return await new Promise<Blob>((resolve, reject) => {
      /** Performs the finish operation. */
      const finish = () => {
        clearTimeout(timer)
        current.onmessage = null
        current.onerror = null
      }

      /** Performs the fail operation. */
      const fail = (message: string) => {
        finish()
        current.terminate()
        worker = undefined
        reject(new Error(message))
      }
      const timer = setTimeout(() => fail("智能换底超时，请缩小图片后重试"), 180_000)
      current.onerror = (event) => fail(event.message || "本地换底引擎加载失败")
      current.onmessage = (event: MessageEvent<{ progress?: string; blob?: Blob; error?: string }>) => {
        if (event.data.progress) {
          progress(event.data.progress)
          return
        }
        if (event.data.error) {
          fail(event.data.error)
          return
        }
        if (event.data.blob) {
          finish()
          resolve(event.data.blob)
        }
      }
      current.postMessage({ image, publicPath })
    })
  } finally {
    running = false
  }
}
