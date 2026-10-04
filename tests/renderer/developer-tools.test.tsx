import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { JsonTool, Base64Tool, URLTool } from '../../src/renderer/src/pages/debug/utility-tools'
afterEach(cleanup)
it('formats JSON and reports malformed input', () => {
 render(<JsonTool />)
 fireEvent.change(screen.getByLabelText('JSON 格式化输入'), { target: { value: '{"a":1}' } })
 fireEvent.click(screen.getByRole('button', {name:'格式化'}))
 expect(screen.getByLabelText('处理结果')).toHaveProperty('value','{\n  "a": 1\n}')
 fireEvent.change(screen.getByLabelText('JSON 格式化输入'), { target: { value: '{' } })
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
