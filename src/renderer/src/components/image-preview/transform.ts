export type ImageOperation = "left" | "right" | "flip" | { x: number; y: number; width: number; height: number }
/** 编辑结果另存为 PNG，原始文件始终保留。 */
export async function transformImage(src: string, operation: ImageOperation): Promise<string> {
  const image = new window.Image()
  image.src = src
  await image.decode()
  const canvas = document.createElement("canvas")
  const rotate = operation === "left" || operation === "right"
  canvas.width = typeof operation === "object" ? operation.width : rotate ? image.naturalHeight : image.naturalWidth
  canvas.height = typeof operation === "object" ? operation.height : rotate ? image.naturalWidth : image.naturalHeight
  if (
    typeof operation === "object" &&
    (![operation.x, operation.y, operation.width, operation.height].every(Number.isInteger) || operation.x < 0 || operation.y < 0 || operation.width < 1 || operation.height < 1 || operation.x + operation.width > image.naturalWidth || operation.y + operation.height > image.naturalHeight)
  )
    throw new Error("裁剪范围超出图片")
  const context = canvas.getContext("2d")
  if (!context) throw new Error("无法创建图片画布")
  if (typeof operation === "object") context.drawImage(image, operation.x, operation.y, operation.width, operation.height, 0, 0, canvas.width, canvas.height)
  else {
    context.translate(canvas.width / 2, canvas.height / 2)
    if (rotate) context.rotate(operation === "right" ? Math.PI / 2 : -Math.PI / 2)
    else context.scale(-1, 1)
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
  }
  return canvas.toDataURL("image/png")
}
