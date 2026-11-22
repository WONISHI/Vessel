import { act } from '@testing-library/react'
import { createRequire } from 'node:module'
import { afterEach, expect, it, vi } from 'vitest'
import { clearCodeHighlights, decorateCodeBlocks } from '@/components/core/canvas/variants/markdown/code-blocks'
createRequire(import.meta.url)('vditor/dist/js/lute/lute.min.js')
const lute = (globalThis as any).Lute.New()
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}))
afterEach(async()=>{await act(async()=>clearCodeHighlights(document.body));document.body.innerHTML='';vi.restoreAllMocks()})
it.each([false,true])('copies the entire code without changing Markdown or opening the language picker (readOnly=%s)', async (readOnly)=>{
 const source='```json\n[\n  {"entered": true}\n]\n```\n'
 const root=document.createElement('div')
 root.innerHTML=lute.Md2VditorIRDOM(source)
 document.body.append(root)
 const before=lute.VditorIRDOM2Md(root.innerHTML)
 const writeText=vi.fn(async()=>{})
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
 const language=vi.fn();root.addEventListener('vessel-code-language',language)
 decorateCodeBlocks(root,readOnly)
 decorateCodeBlocks(root,readOnly)
 const buttons=root.querySelectorAll<HTMLButtonElement>('.vessel-code-copy')
 expect(buttons).toHaveLength(1)
 buttons[0].click()
 await Promise.resolve()
 expect(writeText).toHaveBeenCalledExactlyOnceWith('[\n  {"entered": true}\n]\n')
 expect(language).not.toHaveBeenCalled()
 expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before)
})
