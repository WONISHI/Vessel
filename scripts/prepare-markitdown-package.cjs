const { execFileSync } = require("node:child_process")
const path = require("node:path")

module.exports = async (context) => {
  const arch = { 0: "ia32", 1: "x64", 3: "arm64", 4: "universal" }[context.arch]
  const platform = context.electronPlatformName
  if (platform !== process.platform || arch !== process.arch) {
    throw new Error(`MarkItDown 必须在目标系统和架构上准备并验证，请在 ${platform}-${arch} 上打包。`)
  }
  execFileSync(process.execPath, [path.join(__dirname, "prepare-markitdown.cjs"), "--ensure"], {
    stdio: "inherit",
    env: { ...process.env, VESSEL_MARKITDOWN_PLATFORM: platform, VESSEL_MARKITDOWN_ARCH: arch }
  })
}
