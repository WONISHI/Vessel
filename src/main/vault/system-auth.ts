import { app } from "electron"
import { execFile } from "node:child_process"
import { join } from "node:path"

/** Authenticate every reveal through macOS; never collect the OS password in Vessel. */
export async function authenticatePasswordReveal(): Promise<void> {
  if (process.platform !== "darwin") throw new Error("当前系统暂不支持身份验证，无法查看密码")
  const directory = app.isPackaged ? __dirname.replace(/app\.asar(?=\/)/, "app.asar.unpacked") : __dirname
  await new Promise<void>((resolve, reject) => {
    execFile(join(directory, "vessel-auth"), [], { timeout: 120000, maxBuffer: 4096 }, (error) => {
      if (!error) resolve()
      else reject(new Error("系统身份验证未通过、已取消或不可用，未显示密码"))
    })
  })
}
