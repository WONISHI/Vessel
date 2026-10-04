import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ImageEditorSheet } from '../../src/renderer/src/pages/image-preview/editor-sheet'
import { recognizeImage } from '../../src/renderer/src/lib/image-ocr'
vi.mock('../../src/renderer/src/lib/image-ocr', () => ({ recognizeImage: vi.fn() }))
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} })
afterEach(cleanup)
it('recognizes the current image and presents editable OCR output in the sheet', async () => {
  vi.mocked(recognizeImage).mockResolvedValue('中文识别\neditor.fontSize')
  render(<ImageEditorSheet open onOpenChange={vi.fn()} source="data:image/png;base64,abc" onCrop={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '开始识别' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: '识别结果' })).toHaveProperty('value', '中文识别\neditor.fontSize'))
  expect(recognizeImage).toHaveBeenCalledWith('data:image/png;base64,abc')
})
