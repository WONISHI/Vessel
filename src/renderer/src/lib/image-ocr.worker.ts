import { init, setOCREnv } from '@oovz/esearch-ocr'
import * as ort from 'onnxruntime-web/wasm'

let engine: ReturnType<typeof init> | undefined
self.onmessage = async (event: MessageEvent<{ src: string; assets: string }>) => {
  try {
    const { src, assets } = event.data
    if (!engine) {
      ort.env.wasm.numThreads = 1
      ort.env.wasm.wasmPaths = `${assets}runtime/`
      setOCREnv({ canvas: (w, h) => new OffscreenCanvas(w, h), imageData: (data: Uint8ClampedArray, w: number, h: number) => new ImageData(new Uint8ClampedArray(data), w, h) })
      engine = (async () => {
        const dictionary = await fetch(`${assets}ppocr_keys_v1.txt`).then(r => { if (!r.ok) throw new Error('无法读取 OCR 字典'); return r.text() })
        return init({ ort, det: { input: `${assets}ppocr_det.onnx` }, rec: { input: `${assets}ppocr_rec.onnx`, decodeDic: dictionary }, ortOption: { executionProviders: ['wasm'] } })
      })()
      engine.catch(() => { engine = undefined })
    }
    const ocr = await engine
    const bitmap = await createImageBitmap(await fetch(src).then(r => r.blob()))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const result = await ocr.ocr(context.getImageData(0, 0, canvas.width, canvas.height))
    self.postMessage({ text: result.parragraphs.map(p => p.text).join('\n') })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
