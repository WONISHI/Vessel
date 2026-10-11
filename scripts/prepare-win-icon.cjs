// Lossless format conversion of the existing app artwork to a multi-resolution ICO.
const { nativeImage, app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const source = nativeImage.createFromPath(path.resolve(__dirname, '../resources/icon.png'))
if (source.isEmpty()) throw new Error('Vessel app icon is missing')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = sizes.map(size => source.resize({ width: size, height: size, quality: 'best' }).toPNG())
const header = Buffer.alloc(6 + images.length * 16)
header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4)
let offset = header.length
images.forEach((bytes, index) => {
  const entry = 6 + index * 16
  header[entry] = sizes[index] % 256; header[entry + 1] = sizes[index] % 256
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(bytes.length, entry + 8); header.writeUInt32LE(offset, entry + 12)
  offset += bytes.length
})
fs.writeFileSync(path.resolve(__dirname, '../build/vessel.ico'), Buffer.concat([header, ...images]))

app.exit(0)
