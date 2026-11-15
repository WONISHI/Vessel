// Injected only into a Vessel-managed development server. No Node APIs.
let active = false, hovered = null, busy = false
const layer = document.createElement('div')
layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:none'
const box = document.createElement('div'), label = document.createElement('div')
box.style.cssText = 'position:fixed;border:2px solid #16a34a;background:#16a34a18;border-radius:3px;display:none'
label.style.cssText = 'position:fixed;top:12px;left:12px;max-width:80vw;padding:8px 12px;background:#166534;color:white;border-radius:8px;font:12px system-ui;box-shadow:0 3px 12px #0003'
layer.append(box, label)
function toggle(value = !active) {
  active = value
  hovered = null
  box.style.display = 'none'
  layer.style.display = active ? 'block' : 'none'
  label.textContent = '定位源码：点击绿色高亮元素打开源文件 · Esc 退出'
  if (!layer.isConnected) document.documentElement.append(layer)
  return active
}
function move(event) {
  if (!active || busy) return
  hovered = event.target instanceof Element ? event.target.closest('[data-vessel-source]') : null
  box.style.display = hovered ? 'block' : 'none'
  if (hovered) {
    const rect = hovered.getBoundingClientRect()
    Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
    label.textContent = `${hovered.tagName.toLowerCase()} · 点击打开源码 · Esc 退出`
  } else label.textContent = '此元素没有源码标记（可能来自第三方组件、iframe 或非 Vue 模板）· Esc 退出'
}
async function click(event) {
  if (!active) return
  event.preventDefault(); event.stopImmediatePropagation()
  if (busy) return
  move(event)
  if (!hovered) return
  busy = true; label.textContent = '正在打开编辑器…'
  try {
    const response = await fetch('/__vessel_source_open', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-vessel-source-token': '__VESSEL_TOKEN__' }, body: JSON.stringify({ key: hovered.getAttribute('data-vessel-source') }) })
    if (!response.ok) throw Error(await response.text())
    toggle(false)
  } catch (error) { label.textContent = `定位失败：${error.message} · Esc 退出` }
  finally { busy = false }
}
function block(event) { if (active) { event.preventDefault(); event.stopImmediatePropagation() } }
function keydown(event) { if (active && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); toggle(false) } }
function blur() { toggle(false) }
for (const name of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) window.addEventListener(name, block, true)
window.addEventListener('pointermove', move, true)
window.addEventListener('click', click, true)
window.addEventListener('keydown', keydown, true)
window.addEventListener('blur', blur)
window.__VESSEL_SOURCE_INSPECTOR__ = { toggle }
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('pointermove', move, true); window.removeEventListener('click', click, true); window.removeEventListener('keydown', keydown, true); window.removeEventListener('blur', blur); for (const name of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) window.removeEventListener(name, block, true); layer.remove(); delete window.__VESSEL_SOURCE_INSPECTOR__ })
