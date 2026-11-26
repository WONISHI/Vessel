import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>(), start: vi.fn().mockResolvedValue({ urls: ['http://fixture/share'], startedAt: 1 }), stop: vi.fn(), stopOwner: vi.fn(), status: vi.fn(), dispose: vi.fn() }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  return { app: new EventEmitter(), ipcMain: { handle: (channel: string, handler: any) => state.handlers.set(channel, handler), removeHandler: (channel: string) => state.handlers.delete(channel) } }
})
vi.mock('@main/sharing/json-share-service', () => ({ JsonShareService: class { start = state.start; stop = state.stop; stopOwner = state.stopOwner; status = state.status; dispose = state.dispose } }))
import { app } from 'electron'
import { registerJsonSharing } from '@main/sharing/json-sharing'

it('scopes each IPC to its sender, stops destroyed windows and stops before quitting', async () => {
  const dispose = registerJsonSharing()
  const owner = Object.assign(new EventEmitter(), { id: 12 })
  const event = { sender: owner }
  await state.handlers.get('json-share:start')!(event, '{}')
  await state.handlers.get('json-share:start')!(event, '{}')
  expect(owner.listenerCount('destroyed')).toBe(1)
  expect(state.start).toHaveBeenCalledWith(12, '{}', 'default')
  state.handlers.get('json-share:stop')!(event)
  expect(state.stop).toHaveBeenCalledWith(12, 'default')
  state.handlers.get('json-share:status')!(event)
  expect(state.status).toHaveBeenCalledWith(12, 'default')
  owner.emit('destroyed')
  expect(state.stopOwner).toHaveBeenCalledWith(12)
  app.emit('before-quit', {} as any)
  expect(state.dispose).toHaveBeenCalledOnce()
  dispose()
  expect(state.handlers.size).toBe(0)
  expect(app.listenerCount('before-quit')).toBe(0)
})
