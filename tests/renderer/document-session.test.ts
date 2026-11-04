import { afterEach, expect, it, vi } from 'vitest'
import { documentSession, readDocument, writeDocument } from '@/components/core/canvas/session/document-session'
import { bindMarkdownView } from '@/components/core/canvas/session/markdown-view'
afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })
it('reopening waits for the latest pending write instead of reading stale disk content', async () => {
  let finish!: () => void
  let disk = 'old'
  window.electronAPI = { saveContent: vi.fn(() => new Promise<void>(resolve => { finish = () => { disk = 'latest'; resolve() } })), readContent: vi.fn(async () => disk) } as any
  const pending = writeDocument('/sessions/pending.md', 'latest')
  const read = readDocument('/sessions/pending.md')
  expect(window.electronAPI.readContent).not.toHaveBeenCalled()
  finish(); await pending
  expect(await read).toBe('latest')
  expect(documentSession('/sessions/pending.md').draft).toBeUndefined()
})
it('retains unsaved content when saving fails, including across editor eviction', async () => {
  window.electronAPI = { saveContent: vi.fn().mockRejectedValue(new Error('disk full')), readContent: vi.fn().mockResolvedValue('old') } as any
  await expect(writeDocument('/sessions/failed.md', 'recover me')).rejects.toThrow('disk full')
  expect(await readDocument('/sessions/failed.md')).toBe('recover me')
  expect(window.electronAPI.readContent).not.toHaveBeenCalled()
})
it('restores Markdown selection and scroll using plain offsets after the original DOM is destroyed', () => {
  const build = () => {
    const host = document.createElement('div')
    host.innerHTML = '<div class="vditor-ir"><pre class="vditor-reset" contenteditable="true"><p>first</p><p>second</p></pre></div>'
    document.body.append(host)
    const root = host.querySelector<HTMLElement>('.vditor-reset')!
    root.getClientRects = () => [{ width: 200, height: 100 }] as any
    return { host, root }
  }
  let { host, root } = build()
  const binding = bindMarkdownView(host, '/sessions/view.md')
  root.focus()
  getSelection()!.setBaseAndExtent(root.lastElementChild!.firstChild!, 2, root.lastElementChild!.firstChild!, 4)
  root.scrollTop = 420
  root.dispatchEvent(new Event('scroll'))
  binding.dispose(); host.remove()
  ;({ host, root } = build())
  const next = bindMarkdownView(host, '/sessions/view.md')
  next.restore()
  expect(root.scrollTop).toBe(420)
  expect(getSelection()!.toString()).toBe('co')
  next.dispose()
})
