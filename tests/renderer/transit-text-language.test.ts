import { expect, it } from 'vitest'
import { transitTextLanguage } from '@/components/transit/text-language'
it('detects structured and code snippets without changing their source', () => {
 expect(transitTextLanguage('{"id":"123"}')).toBe('json')
 expect(transitTextLanguage('async function query(p: string): Promise<number> { return 1 }')).toBe('typescript')
 expect(transitTextLanguage('const token = "example"')).toBe('javascript')
 expect(transitTextLanguage('普通剪贴板文本')).toBe('plaintext')
})
