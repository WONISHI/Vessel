import { expect, it, vi } from 'vitest'
import { readBrowserFaviconData } from '@main/browser/browser-favicon'
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path fill="#4792f1" d="M0 0h16v16H0z"/></svg>'
const response = () => new Response(svg, { headers: { 'content-type': 'image/svg+xml' } })

it('uses private session cookies and never samples or requests icons through the normal session', async () => {
  const normal = vi.fn().mockResolvedValue(response())
  const own = vi.fn().mockImplementation(async () => response())
  const host = { session: { fetch: normal }, executeJavaScript: vi.fn().mockResolvedValue({ x: 1, y: 1, width: 16, height: 16 }), capturePage: vi.fn() } as any
  const result = await readBrowserFaviconData(host, { session: { fetch: own } } as any, 'https://private.test/icon.svg', true)
  expect(result).toBe(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  expect(own).toHaveBeenCalledWith('https://private.test/icon.svg', expect.objectContaining({ credentials: 'include' }))
  expect(normal).not.toHaveBeenCalled()
  expect(host.executeJavaScript).not.toHaveBeenCalled()
  expect(host.capturePage).not.toHaveBeenCalled()
})

it('retains the normal-window painted-icon fast path and rejects non-image responses', async () => {
  const painted = { isEmpty: () => false, toDataURL: () => 'data:image/png;base64,painted' }
  const host = { session: { fetch: vi.fn() }, executeJavaScript: vi.fn().mockResolvedValue({ x: 1, y: 1, width: 16, height: 16 }), capturePage: vi.fn().mockResolvedValue(painted) } as any
  expect(await readBrowserFaviconData(host, { session: {} } as any, 'https://normal.test/icon.svg', false)).toBe('data:image/png;base64,painted')
  const own = vi.fn().mockResolvedValue(new Response('login', { headers: { 'content-type': 'text/html' } }))
  expect(await readBrowserFaviconData(host, { session: { fetch: own } } as any, 'https://private.test/icon.svg', true)).toBeUndefined()
  own.mockClear()
  expect(await readBrowserFaviconData(host, { session: { fetch: own } } as any, 'file:///private/file', true)).toBeUndefined()
  expect(own).not.toHaveBeenCalled()
})
