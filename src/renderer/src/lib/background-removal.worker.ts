import { removeBackground } from '@vessel/image-matting'

self.onmessage = async (event: MessageEvent<{ image: Blob; publicPath: string }>) => {
  try {
    const blob = await removeBackground(event.data.image, {
      publicPath: event.data.publicPath,
      model: 'isnet_fp16', device: 'cpu', proxyToWorker: false,
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => self.postMessage({ progress: key.startsWith('fetch:') ? `正在读取本地换底资源：${(current / 1_000_000).toFixed(1)}${total ? ` / ${(total / 1_000_000).toFixed(1)}` : ''} MB` : '正在识别图片主体与边缘…' })
    })
    self.postMessage({ blob })
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }) }
}
