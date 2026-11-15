const { execFileSync } = require("node:child_process")
const path = require("node:path")

module.exports = async () => {
  execFileSync(process.execPath, [path.join(__dirname, "../packages/@vessel/clipper/scripts/build.cjs")], { stdio: "inherit", cwd: path.resolve(__dirname, "..") })
}
