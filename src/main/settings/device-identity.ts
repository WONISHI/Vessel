import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { hostname, networkInterfaces, platform, type NetworkInterfaceInfo } from "node:os"
import { promisify } from "node:util"
const execute = promisify(execFile)

/** Prefer a physical Ethernet/Wi-Fi interface; never display a loopback or zero address. */
export function deviceDisplayName(model: string, interfaces: Record<string, NetworkInterfaceInfo[] | undefined>): string {
  const candidates = Object.entries(interfaces)
    .filter(([name]) => !/^(?:lo\d*|utun|tun|tap|veth|docker|br-|bridge|vmnet|vbox|awdl|llw|tailscale|wg)/i.test(name))
    .sort(([a], [b]) => Number(!/^(?:en0|eth0|wlan0|wi-fi|ethernet)$/i.test(a)) - Number(!/^(?:en0|eth0|wlan0|wi-fi|ethernet)$/i.test(b)) || a.localeCompare(b))
    .flatMap(([, addresses]) => addresses || [])
  const mac = candidates.find((item) => !item.internal && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(item.mac) && item.mac !== "00:00:00:00:00:00")?.mac.toUpperCase()
  return `${model.trim() || hostname()} · ${mac || "MAC 地址不可用"}`
}

export async function getDeviceDisplayName(): Promise<string> {
  let model = ""
  try {
    if (platform() === "darwin") model = (await execute("/usr/sbin/sysctl", ["-n", "hw.model"], { timeout: 3000 })).stdout.trim()
    else if (platform() === "win32") model = (await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-CimInstance Win32_ComputerSystem).Model"], { timeout: 5000 })).stdout.trim()
    else model = (await readFile("/sys/class/dmi/id/product_name", "utf8")).trim()
  } catch { /* Hostname remains available on systems that do not expose their model. */ }
  return deviceDisplayName(model, networkInterfaces())
}
