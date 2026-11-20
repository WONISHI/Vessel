import { dialog, type BrowserWindow, type WebContents } from "electron"
import { writeFile } from "node:fs/promises"
import { nodeScreenshotLayout } from "./node-screenshot-layout"
import { notifyBrowserFileSaved } from "./browser-downloads"

/** Await the actual file write so a cancelled save never produces a preview prompt. */
export function registerBrowserNodeScreenshotSave(frontend: WebContents, host: WebContents, owner: () => BrowserWindow | undefined) {
  frontend.ipc.handle("browser:save-node-screenshot", async (_event, data: unknown) => {
    if (typeof data !== "string" || data.length > 128 * 1024 * 1024) throw new Error("截图数据无效或过大")
    const image = Buffer.from(data, "base64")
    if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("截图数据无效")
    const options = { defaultPath: "node-screenshot.png", filters: [{ name: "PNG 图片", extensions: ["png"] }] }
    const window = owner()
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, image)
    await notifyBrowserFileSaved(host, result.filePath, "save")
    return true
  })
}

/** Detached DevTools omits DeviceModeWrapper, but its Elements menu still calls it. */
export function nodeScreenshotScript() {
  return `(async () => {
    if (new URL(location.href).searchParams.get('can_dock')) return;
    const [Emulation, SDK, Host] = await Promise.all([
      import('devtools://devtools/bundled/panels/emulation/emulation.js'),
      import('devtools://devtools/bundled/core/sdk/sdk.js'),
      import('devtools://devtools/bundled/core/host/host.js')
    ]);
    const prototype = Emulation.DeviceModeWrapper.ActionDelegate.prototype;
    if (prototype.__vesselNodeScreenshot) return;
    const original = prototype.handleAction;
    let pending = false;
    const capture = async (context) => {
      const node = context.flavor(SDK.DOMModel.DOMNode);
      if (!node) throw new Error('请先选择要截图的元素');
      const object = await node.resolveToObject();
      if (!object) throw new Error('元素已失效，请重新选择');
      let layout;
      let data;
      try {
        const preparation = await object.callFunction(${nodeScreenshotLayout});
        layout = preparation.object;
        if (preparation.wasThrown || !layout) throw new Error(layout?.description || '无法展开元素内容');
        const result = await layout.callFunction(function () { return this.measure(); });
        let box;
        try {
          if (result.wasThrown || !result.object?.value) throw new Error('无法读取元素尺寸');
          box = JSON.parse(result.object.value);
        } finally { result.object?.release(); }
        if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) throw new Error('该元素没有可截图的显示区域');
        const target = node.domModel().target();
        const metrics = await target.pageAgent().invoke_getLayoutMetrics();
        if (metrics.getError()) throw new Error(metrics.getError());
        const zoom = metrics.visualViewport?.zoom || 1;
        for (const key of ['x', 'y', 'width', 'height']) box[key] *= zoom;
        const model = target.model(SDK.ScreenCaptureModel.ScreenCaptureModel);
        if (!model) throw new Error('当前页面不支持元素截图');
        data = await model.captureScreenshot('png', 100, 'fromClip', box);
        if (!data) throw new Error('生成元素截图失败');
      } finally {
        try {
          if (layout) {
            const restored = await layout.callFunction(function () { if (this.restore) this.restore(); });
            restored.object?.release();
          }
        } finally { layout?.release(); object.release(); }
      }
      if (globalThis.vesselDevtools?.saveNodeScreenshot) await globalThis.vesselDevtools.saveNodeScreenshot(data);
      else Host.InspectorFrontendHost.InspectorFrontendHostInstance.save('node-screenshot.png', data, true, true);
    };
    prototype.handleAction = function (context, action) {
      if (action !== 'emulation.capture-node-screenshot') return original.call(this, context, action);
      if (!pending) {
        pending = true;
        void capture(context).catch(error => {
          console.error('Vessel node screenshot:', error);
          const notice = document.createElement('div');
          notice.setAttribute('role', 'alert');
          notice.textContent = '元素截图失败：' + (error.message || String(error));
          notice.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:2147483647;padding:12px;border-radius:8px;background:#b91c1c;color:white;font:13px system-ui';
          document.body.append(notice);
          setTimeout(() => notice.remove(), 8000);
        }).finally(() => { pending = false; });
      }
      return true;
    };
    prototype.__vesselNodeScreenshot = true;
  })()`
}

export async function enableBrowserNodeScreenshots(frontend: WebContents) {
  if (!frontend.isDestroyed()) await frontend.executeJavaScript(nodeScreenshotScript())
}
