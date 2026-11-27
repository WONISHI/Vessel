import { EventEmitter } from "node:events"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  quit: vi.fn(), dispose: vi.fn(), drainFiles: vi.fn(), drainSessions: vi.fn(),
  closeTerminals: vi.fn(), resumeTerminals: vi.fn(), showError: vi.fn(), showMessage: vi.fn()
}))
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events")
  return { app: Object.assign(new EventEmitter(), { quit: mocks.quit }), dialog: { showErrorBox: mocks.showError, showMessageBox: mocks.showMessage } }
})
vi.mock("@main/app/index", () => ({ mainApps: { dispose: mocks.dispose } }))
vi.mock("@main/modules/files/index.module", () => ({ drainTextFileWrites: mocks.drainFiles }))
vi.mock("@main/modules/welcome/workspace-sessions", () => ({ drainWorkspaceSessionWrites: mocks.drainSessions }))
vi.mock("@main/terminal/terminal", () => ({ closeAllTerminals: mocks.closeTerminals, resumeTerminalStarts: mocks.resumeTerminals }))

import { app } from "electron"
import { runDataOperation } from "@main/database/data-domain"
import { registerQuitLifecycle } from "@main/app/quit-lifecycle"

const events = app as unknown as EventEmitter
const emitBeforeQuit = () => {
  const event = { preventDefault: vi.fn() }
  events.emit("before-quit", event)
  return event
}

beforeEach(() => {
  events.removeAllListeners()
  mocks.drainFiles.mockReset()
  mocks.drainSessions.mockReset()
  registerQuitLifecycle()
})
afterEach(() => { events.removeAllListeners(); vi.useRealTimers() })

it("keeps modules available while windows close, including when unloading is cancelled", () => {
  expect(emitBeforeQuit().preventDefault).not.toHaveBeenCalled()
  expect(mocks.dispose).not.toHaveBeenCalled()
  // A blocked window can keep running and later request quitting again.
  emitBeforeQuit()
  expect(mocks.dispose).not.toHaveBeenCalled()
  events.emit("will-quit")
  expect(mocks.dispose).toHaveBeenCalledTimes(1)
})

it("waits for both write queues and retries quitting without disposing live IPC", async () => {
  vi.useFakeTimers()
  let finishFiles!: () => void
  let finishSessions!: () => void
  mocks.drainFiles.mockReturnValueOnce(new Promise<void>((resolve) => { finishFiles = resolve }))
  mocks.drainSessions.mockReturnValueOnce(new Promise<void>((resolve) => { finishSessions = resolve }))
  expect(emitBeforeQuit().preventDefault).toHaveBeenCalledOnce()
  expect(emitBeforeQuit().preventDefault).toHaveBeenCalledOnce()
  finishFiles()
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.quit).not.toHaveBeenCalled()
  finishSessions()
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.quit).toHaveBeenCalledOnce()
  expect(mocks.dispose).not.toHaveBeenCalled()
  events.emit("will-quit")
  expect(mocks.dispose).toHaveBeenCalledOnce()
})

it("leaves the application usable when saving fails", async () => {
  vi.useFakeTimers()
  vi.spyOn(console, "error").mockImplementation(() => {})
  mocks.drainFiles.mockRejectedValueOnce(new Error("disk unavailable"))
  emitBeforeQuit()
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.resumeTerminals).toHaveBeenCalledOnce()
  expect(mocks.showError).toHaveBeenCalledOnce()
  expect(mocks.quit).not.toHaveBeenCalled()
  expect(mocks.dispose).not.toHaveBeenCalled()
  expect(emitBeforeQuit().preventDefault).not.toHaveBeenCalled()
})

it("keeps the application alive until an in-flight domain database operation completes", async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const operation = runDataOperation(['todos.sqlite'], () => new Promise<void>(resolve => { finish = resolve }))
  await Promise.resolve()
  expect(emitBeforeQuit().preventDefault).toHaveBeenCalledOnce()
  expect(mocks.quit).not.toHaveBeenCalled()
  finish(); await operation
  await vi.advanceTimersByTimeAsync(0)
  expect(mocks.quit).toHaveBeenCalledOnce()
  expect(mocks.dispose).not.toHaveBeenCalled()
})
