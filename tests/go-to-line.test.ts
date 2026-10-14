import { expect, it } from 'vitest'
import { parseLinePosition } from '../src/renderer/src/components/core/canvas/variants/code/go-to-line'
it('accepts line or line:column and rejects invalid ranges before asking the editor for columns', () => {
  const maxColumn = (line: number) => { if (line < 1 || line > 42) throw new Error('invalid line'); return line === 42 ? 1 : 20 }
  expect(parseLinePosition('12', 42, maxColumn)).toEqual({ lineNumber: 12, column: 1 })
  expect(parseLinePosition(' 12 : 20 ', 42, maxColumn)).toEqual({ lineNumber: 12, column: 20 })
  expect(parseLinePosition('42', 42, maxColumn)).toEqual({ lineNumber: 42, column: 1 })
  for (const value of ['', 'abc', '0', '-1', '43', '12:0', '12:21', '42:2', '1.5', '9007199254740993']) expect(parseLinePosition(value, 42, maxColumn)).toBeNull()
})
