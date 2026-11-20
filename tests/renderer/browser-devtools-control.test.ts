import { EventEmitter } from "node:events"
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ ipc: undefined as any, expose: vi.fn() }))
vi.mock("electron", () => ({ get ipcRenderer() { return mock.ipc }, contextBridge: { exposeInMainWorld: mock.expose } }))
it("renders the native-surface control and routes clicks back to the host menu", async () => {
  mock.ipc = Object.assign(new EventEmitter(), { send: vi.fn(), invoke: vi.fn().mockResolvedValue(true) })
  await import("../../src/preload/browser-devtools")
  const bridge = mock.expose.mock.calls.find(([name]) => name === "vesselDevtools")![1]
  await bridge.saveNodeScreenshot("base64-png")
  expect(mock.ipc.invoke).toHaveBeenCalledExactlyOnceWith("browser:save-node-screenshot", "base64-png")
  mock.ipc.emit("browser:control-overlay", {}, { x: 400, y: 200, width: 48, height: 48, icon: '<svg xmlns="http://www.w3.org/2000/svg"/>', color: "rgb(87, 83, 78)", background: "white", border: "gray", shadow: "none" })
  const button = document.querySelector('button[aria-label="控制台菜单"]') as HTMLButtonElement
  expect(button.style.left).toBe("400px")
  expect(button.style.top).toBe("200px")
  expect(button.style.zIndex).toBe("2147483647")
  button.click()
  expect(mock.ipc.send).toHaveBeenCalledWith("browser:devtools-control")
  mock.ipc.emit("browser:control-overlay", {}, undefined)
  expect(button.isConnected).toBe(false)
})
