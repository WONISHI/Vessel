import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ImageEditorSheet } from '../../src/renderer/src/pages/image-preview/editor-sheet'
vi.mock('../../src/renderer/src/lib/image-ocr', () => ({ recognizeImage: vi.fn() }))
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} })
afterEach(cleanup)
it('opens the image toolbox in a sheet without an overlay', () => {
  render(<ImageEditorSheet open onOpenChange={vi.fn()} source="data:image/png;base64,abc" />)
  expect(screen.getByRole('heading', { name: '图片工具箱', level: 1 })).toBeTruthy()
  expect(screen.getByRole('button', { name: '标注' })).toBeTruthy()
  expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull()
})
