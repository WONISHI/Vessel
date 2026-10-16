// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { cropImage } from '../../src/renderer/src/pages/image-preview/image-operations'
import { portraitBackground } from '../../src/renderer/src/lib/portrait-matting'
import { ImageToolbox } from '../../src/renderer/src/pages/image-preview/image-toolbox'
vi.mock('../../src/renderer/src/lib/portrait-matting', () => ({ portraitBackground: vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,background' })) }))
vi.mock('../../src/renderer/src/lib/image-ocr', () => ({ recognizeImage: vi.fn() }))
vi.mock('../../src/renderer/src/pages/image-preview/image-operations', async original => ({
  ...await original<object>(), loadImage: vi.fn(async () => ({ naturalWidth: 1000, naturalHeight: 800 })), cropImage: vi.fn(async () => ({ toDataURL: () => 'data:image/png;base64,edited' }))
}))
vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn() })
afterEach(cleanup)
it('shows photo presets and a matching crop frame, then exposes background colour controls', async () => {
  render(<ImageToolbox initialImage="data:image/png;base64,test" initialTool="crop" />)
  await screen.findByAltText('待处理图片')
  fireEvent.change(screen.getByLabelText('证件照尺寸'), { target: { value: 'two' } })
  await waitFor(() => expect(screen.getByText(/开启后输出 413 × 579 px/)).toBeTruthy())
  const crop = document.querySelector('.image-crop') as HTMLElement
  expect(parseFloat(crop.style.width) / parseFloat(crop.style.height)).toBeCloseTo(413 / 579)
  fireEvent.click(screen.getByRole('button', { name: '更换背景色' }))
  expect(screen.getByLabelText('目标背景色')).toBeTruthy()
  expect(screen.getByRole('button', { name: '应用背景色' })).toBeTruthy()
})

it('clears the image, restores the imported original, and undoes a reset', async () => {
  render(<ImageToolbox initialImage="data:image/png;base64,original" initialTool="crop" />)
  await screen.findByAltText('待处理图片')
  fireEvent.click(screen.getByRole('button', { name: '应用裁剪' }))
  await waitFor(() => expect(screen.getByAltText('待处理图片').getAttribute('src')).toBe('data:image/png;base64,edited'))
  fireEvent.click(within(document.querySelector('.image-header-actions') as HTMLElement).getByRole('button', { name: '重置' }))
  await waitFor(() => expect(screen.getByAltText('待处理图片').getAttribute('src')).toBe('data:image/png;base64,original'))
  fireEvent.click(screen.getByRole('button', { name: '撤回', exact: true }))
  await waitFor(() => expect(screen.getByAltText('待处理图片').getAttribute('src')).toBe('data:image/png;base64,edited'))
  fireEvent.click(screen.getByRole('button', { name: '清空', exact: true }))
  expect(screen.queryByAltText('待处理图片')).toBeNull()
  expect((screen.getByRole('button', { name: '撤回', exact: true }) as HTMLButtonElement).disabled).toBe(true)
})

it('keeps full crop resolution unless standard photo output is explicitly enabled', async () => {
  render(<ImageToolbox initialImage="data:image/png;base64,original" initialTool="crop" />)
  await screen.findByAltText('待处理图片')
  fireEvent.change(screen.getByLabelText('证件照尺寸'), { target: { value: 'two' } })
  fireEvent.click(screen.getByRole('button', { name: '应用裁剪' }))
  await waitFor(() => expect(cropImage).toHaveBeenCalledWith('data:image/png;base64,original', expect.anything(), undefined))
  expect(vi.mocked(cropImage).mock.calls.at(-1)![1].height).toBeCloseTo(800)
  await waitFor(() => expect((screen.getByRole('button', { name: '应用裁剪' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('证件照尺寸'), { target: { value: 'two' } })
  fireEvent.click(screen.getByRole('switch', { name: '按证件照像素输出' }))
  fireEvent.click(screen.getByRole('button', { name: '应用裁剪' }))
  await waitFor(() => expect(cropImage).toHaveBeenLastCalledWith('data:image/png;base64,edited', expect.anything(), { width: 413, height: 579 }))
})

it('uses Slider controls and applies model background replacement without reprocessing the last flattened result', async () => {
  render(<ImageToolbox initialImage="data:image/png;base64,original" initialTool="background" />)
  await screen.findByAltText('待处理图片')
  expect(screen.queryByRole('button', { name: '智能换底' })).toBeNull()
  expect(document.querySelector('input[type="range"]')).toBeNull()
  const slider = screen.getByRole('slider', { name: '主体边缘羽化 (px)' })
  expect(slider.getAttribute('aria-valuenow')).toBe('6')
  fireEvent.keyDown(slider, { key: 'ArrowLeft' })
  expect(slider.getAttribute('aria-valuenow')).toBe('5')
  fireEvent.click(screen.getByRole('button', { name: '应用背景色' }))
  await waitFor(() => expect(portraitBackground).toHaveBeenCalledWith('data:image/png;base64,original', '#438edb', expect.any(Function), { feather: 5, decontaminate: true, shadowCleanup: 50 }))
  await waitFor(() => expect((screen.getByRole('button', { name: '应用背景色' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '白色' }))
  fireEvent.click(screen.getByRole('button', { name: '应用背景色' }))
  await waitFor(() => expect(portraitBackground).toHaveBeenLastCalledWith('data:image/png;base64,original', '#ffffff', expect.any(Function), { feather: 5, decontaminate: true, shadowCleanup: 50 }))
})
