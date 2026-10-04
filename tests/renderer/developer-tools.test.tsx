import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { JsonTool, Base64Tool, URLTool } from '../../src/renderer/src/pages/debug/utility-tools'
vi.mock('../../src/renderer/src/components/core/canvas/variants/code/monaco', () => ({ monaco: {} }))
vi.mock('@monaco-editor/react', () => ({ default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <textarea aria-label="JSON 编辑器" value={value} onChange={event => onChange(event.target.value)} /> }))
afterEach(cleanup)
it('formats JSON and reports malformed input', () => {
 render(<JsonTool />)
 fireEvent.change(screen.getByLabelText('JSON 编辑器'), { target: { value: '{"a":1}' } })
 fireEvent.click(screen.getByRole('button', {name:'格式化'}))
 expect(screen.getByLabelText('JSON 编辑器')).toHaveProperty('value','{\n  "a": 1\n}')
 fireEvent.click(screen.getByRole('button', {name:'压缩'}))
 expect(screen.getByLabelText('JSON 编辑器')).toHaveProperty('value','{"a":1}')
 expect(screen.queryByLabelText('处理结果')).toBeNull()
 fireEvent.change(screen.getByLabelText('JSON 编辑器'), { target: { value: '{' } })
 fireEvent.click(screen.getByRole('button', {name:'格式化'}))
 expect(screen.getByRole('alert')).toBeTruthy()
})
it('round trips Unicode Base64 and URL encoding', () => {
 for (const [Tool,label] of [[Base64Tool,'Base64'],[URLTool,'URL 编解码']] as const) {
  const view = render(<Tool />)
  fireEvent.change(screen.getByLabelText(label+'输入'), {target:{value:'中文 🟢 &/?'}})
  fireEvent.click(screen.getByRole('button',{name:'编码'}))
  const encoded = (screen.getByLabelText('处理结果') as HTMLTextAreaElement).value
  fireEvent.change(screen.getByLabelText(label+'输入'), {target:{value:encoded}})
  fireEvent.click(screen.getByRole('button',{name:'解码'}))
  expect(screen.getByLabelText('处理结果')).toHaveProperty('value','中文 🟢 &/?')
  view.unmount()
 }
})
