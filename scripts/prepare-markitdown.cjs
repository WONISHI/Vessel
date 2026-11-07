// Download a relocatable CPython and install MarkItDown into resources/markitdown.
// Do not copy .venv-markitdown: that venv points at a host Python and is not shippable.
const fs = require("node:fs")
const path = require("node:path")
const { execFileSync } = require("node:child_process")
const { createHash } = require("node:crypto")

const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "resources/markitdown")
const REQUIREMENTS = path.join(ROOT, "resources/markitdown-requirements.txt")
const CACHE = path.join(ROOT, "tmp/python-build-standalone")
const RELEASE = process.env.VESSEL_MARKITDOWN_PYTHON_RELEASE || "20260610"
const CPYTHON = process.env.VESSEL_MARKITDOWN_PYTHON_VERSION || "3.12.13"
const VARIANT = "install_only"

/** Maps Node platform/arch to python-build-standalone triples. */
function resolveTarget() {
  const platform = process.env.VESSEL_MARKITDOWN_PLATFORM || process.platform
  const arch = process.env.VESSEL_MARKITDOWN_ARCH || process.arch
  const key = `${platform}-${arch}`
  const table = {
    "darwin-arm64": "aarch64-apple-darwin",
    "darwin-x64": "x86_64-apple-darwin",
    "linux-arm64": "aarch64-unknown-linux-gnu",
    "linux-x64": "x86_64-unknown-linux-gnu",
    "win32-arm64": "aarch64-pc-windows-msvc",
    "win32-x64": "x86_64-pc-windows-msvc"
  }
  const triple = table[key]
  if (!triple) throw new Error(`不支持的 MarkItDown 运行时目标：${key}`)
  return { platform, arch, triple }
}

/** Builds the GitHub asset filename for the pinned standalone build. */
function assetName(triple) {
  return `cpython-${CPYTHON}+${RELEASE}-${triple}-${VARIANT}.tar.gz`
}

/** Downloads download. */
function download(url, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.tmp`
  execFileSync("curl", ["-L", "--fail", "--retry", "3", "--retry-delay", "2", "--max-time", "300", "--show-error", "-o", temp, url], { stdio: "inherit" })
  fs.renameSync(temp, target)
}

/** Removes a directory tree if present. */
function removeTree(directory) {
  fs.rmSync(directory, { recursive: true, force: true })
}

/** Finds the interpreter path inside the prepared runtime. */
function pythonBinary(root, platform) {
  if (platform === "win32") return path.join(root, "python.exe")
  return path.join(root, "bin", "python3")
}

/** Verifies MarkItDown imports against the prepared interpreter. */
function verify(python) {
  execFileSync(python, ["-I", "-c", "import sys; from markitdown import MarkItDown; from markitdown.converters import PdfConverter; print(sys.version.split()[0]); print('markitdown-ok')"], { stdio: "inherit", timeout: 120000 })
}

/** Performs the main operation. */
function main() {
  const checkOnly = process.argv.includes("--check")
  const { platform, arch, triple } = resolveTarget()
  const name = assetName(triple)
  const python = pythonBinary(OUT, platform)
  const marker = path.join(OUT, ".vessel-markitdown.json")
  const requirementsHash = createHash("sha256").update(fs.readFileSync(REQUIREMENTS)).digest("hex")
  const metadata = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : null
  const matches = metadata && metadata.platform === platform && metadata.arch === arch && metadata.release === RELEASE && metadata.cpython === CPYTHON && metadata.requirementsHash === requirementsHash

  if (process.argv.includes("--ensure") && matches && fs.existsSync(python)) {
    verify(python)
    return
  }

  if (checkOnly) {
    if (!fs.existsSync(python)) throw new Error("缺少打包用 MarkItDown 运行时，请运行 npm run assets:markitdown")
    if (!fs.existsSync(marker)) throw new Error("MarkItDown 运行时元数据缺失，请重新运行 npm run assets:markitdown")
    if (!matches) throw new Error("MarkItDown 运行时目标或依赖不匹配，请重新运行 npm run assets:markitdown")
    verify(python)
    console.log("MarkItDown standalone runtime verified:", python)
    return
  }

  if (!fs.existsSync(REQUIREMENTS)) throw new Error(`缺少依赖清单：${REQUIREMENTS}`)

  fs.mkdirSync(CACHE, { recursive: true })
  const archive = path.join(CACHE, name)
  const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE}/${name}`
  if (!fs.existsSync(archive) || fs.statSync(archive).size < 1_000_000) {
    console.log("Downloading standalone CPython:", name)
    download(url, archive)
  } else {
    console.log("Reusing cached standalone CPython:", archive)
  }

  const extractRoot = path.join(CACHE, `extract-${triple}`)
  removeTree(extractRoot)
  fs.mkdirSync(extractRoot, { recursive: true })
  execFileSync("tar", ["-xzf", path.basename(archive), "-C", path.basename(extractRoot)], { cwd: CACHE, stdio: "inherit" })

  const extractedPython = path.join(extractRoot, "python")
  if (!fs.existsSync(extractedPython)) throw new Error(`独立 Python 解压结果异常：未找到 ${extractedPython}`)

  removeTree(OUT)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.renameSync(extractedPython, OUT)
  removeTree(extractRoot)

  const interpreter = pythonBinary(OUT, platform)
  if (!fs.existsSync(interpreter)) throw new Error(`独立 Python 缺少解释器：${interpreter}`)

  console.log("Installing MarkItDown into standalone runtime…")
  execFileSync(interpreter, ["-m", "pip", "install", "--cache-dir", path.join(CACHE, "pip"), "--progress-bar", "off", "-r", REQUIREMENTS], { stdio: "inherit" })

  // Drop bundled ensurepip wheels that are not needed at runtime.
  for (const base of ["lib", "Lib"]) {
    const libRoot = path.join(OUT, base)
    if (!fs.existsSync(libRoot)) continue
    for (const entry of fs.readdirSync(libRoot)) {
      if (!entry.startsWith("python")) continue
      removeTree(path.join(libRoot, entry, "ensurepip", "_bundled"))
    }
  }

  const digest = createHash("sha256").update(fs.readFileSync(archive)).digest("hex")
  fs.writeFileSync(
    marker,
    JSON.stringify(
      {
        release: RELEASE,
        cpython: CPYTHON,
        variant: VARIANT,
        triple,
        platform,
        arch,
        archive: name,
        sha256: digest,
        requirements: path.basename(REQUIREMENTS),
        requirementsHash,
        preparedAt: new Date().toISOString()
      },
      null,
      2
    ) + "\n"
  )

  verify(interpreter)
  console.log("MarkItDown standalone runtime ready at", OUT)
}

fs.mkdirSync(CACHE, { recursive: true })
const lock = path.join(CACHE, "prepare.lock")
let descriptor
try {
  descriptor = fs.openSync(lock, "wx")
  fs.writeFileSync(descriptor, String(process.pid))
} catch (error) {
  if (error.code === "EEXIST") throw new Error(`另一个任务正在准备 MarkItDown；若任务已退出，请删除 ${lock} 后重试。`)
  throw error
}
try {
  main()
} finally {
  fs.closeSync(descriptor)
  fs.unlinkSync(lock)
}
