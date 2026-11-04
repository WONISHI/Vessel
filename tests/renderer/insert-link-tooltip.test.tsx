import { act, renderHook, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLinkTooltip } from '@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-link-tooltip'
afterEach(() => { cleanup(); document.body.replaceChildren(); getSelection()?.removeAllRanges(); vi.restoreAllMocks() })
it.each(['', '百度'])('anchors above the insertion start and commits the requested Markdown with selected text %s', (selected) => {
  const host = document.createElement('div')
  host.innerHTML = `<div class="vditor-ir"><div contenteditable="true"><p>${selected || '<br>'}</p></div></div>`
  document.body.append(host)
  const editable = host.querySelector<HTMLElement>('[contenteditable]')!
  const range = document.createRange()
  range.selectNodeContents(editable.querySelector('p')!)
  if (!selected) range.collapse(true)
  getSelection()!.removeAllRanges(); getSelection()!.addRange(range)
  Range.prototype.getBoundingClientRect = vi.fn(() => ({ left: 50, top: 180, bottom: 202, width: 0, height: 22 } as DOMRect))
  const editor = {
    getValue: vi.fn(() => ''),
    insertValue: vi.fn(() => {
      const target = document.createElement('span')
      target.dataset.type = 'a'; target.textContent = '[](https://)'
      target.getBoundingClientRect = () => ({ left: 300, top: 180, bottom: 202, width: 180, height: 22 } as DOMRect)
      editable.querySelector('p')!.append(target)
    })
  }
  const { result } = renderHook(() => useLinkTooltip({ readOnly: false, instance: { current: editor }, host: { current: host }, properties: null, changeHandler: { current: vi.fn() } } as any))
  act(() => result.current.triggerInsertLink(undefined, { left: 500, top: 20 }))
  expect(result.current.linkTooltip?.anchor.left).toBe(50)
  expect(result.current.linkTooltip?.initialUrl).toBe('')
  expect(editor.insertValue).not.toHaveBeenCalled()
  act(() => result.current.handleConfirmLink('www.baidu.com'))
  expect(editor.insertValue).toHaveBeenLastCalledWith(`[${selected || 'www.baidu.com'}](www.baidu.com)`, true)
  expect(result.current.linkTooltip).toBeNull()
})
