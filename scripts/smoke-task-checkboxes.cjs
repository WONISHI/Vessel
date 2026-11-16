/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")
const root = path.resolve()
const directory = process.env.VESSEL_TASK_SMOKE || fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-task-smoke-"))
if (!process.argv.includes("--run")) {
  const requireFromVite = require("node:module").createRequire(require.resolve("vite/package.json"))
  requireFromVite("esbuild").buildSync({ stdin: { contents: `import {bindTaskCheckboxes} from '@/components/core/canvas/variants/markdown/task-checkboxes';window.disposeTasks=bindTaskCheckboxes(document.getElementById('editor'));`, resolveDir: root, loader: "ts" }, bundle: true, jsx: "automatic", format: "iife", alias: { "@": path.join(root, "src/renderer/src") }, outfile: path.join(directory, "fixture.js"), logLevel: "error" })
  require("postcss")([require("tailwindcss")(path.join(root, "tailwind.config.js"))]).process(fs.readFileSync("src/renderer/src/assets/tailwind.css", "utf8"), { from: path.join(root, "src/renderer/src/assets/tailwind.css") }).then((result) => {
    fs.writeFileSync(path.join(directory, "fixture.css"), result.css + fs.readFileSync("src/renderer/src/components/core/canvas/variants/markdown/index.css", "utf8"))
    const tasks = Array.from({ length: 40 }, (_, i) => `<li><input type="checkbox">任务 ${i}</li>`).join("")
    fs.writeFileSync(path.join(directory, "index.html"), `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./fixture.css"><style>html{font:14px system-ui}body{padding:20px;background:#eee}.shell{width:600px;background:white;border:1px solid #ddd;display:flex;flex-direction:column}header{height:70px;padding:20px;background:white}.toolbar{height:40px;padding:10px;background:white}.scroller{height:240px;overflow:auto;position:relative}footer{height:40px;padding:10px;background:white}.vditor-reset{padding:0 30px!important}li{height:30px;list-style:none;display:flex;align-items:center;gap:10px}input{width:16px;height:16px}</style><div class="shell"><header>工作台 · 文档标签栏</header><div class="toolbar">正文工具栏</div><div class="scroller"><div id="editor" class="vessel-vditor vditor"><div class="vditor-ir"><div class="vditor-reset" contenteditable="true"><ul>${tasks}</ul></div></div></div></div><footer>控制台  |  已备份  |  文档状态栏</footer></div><script src="./fixture.js"></script>`)
    const env = { ...process.env, VESSEL_TASK_SMOKE: directory }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(require("electron"), [__filename, "--run"], { env, stdio: "inherit" })
    const timer = setTimeout(() => { child.kill("SIGKILL"); console.error("Task preview timed out") }, 20000)
    child.on("exit", (code) => { clearTimeout(timer); process.exitCode = code ?? 1 })
  }).catch((error) => { console.error(error); process.exitCode = 1 })
} else {
  const { app, BrowserWindow } = require("electron")
  const assert = require("node:assert/strict")
  app.setPath("userData", path.join(directory, "profile"))
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 670, height: 500, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await win.loadFile(path.join(directory, "index.html"))
    win.show()
    await new Promise((resolve) => setTimeout(resolve, 100))
    await win.webContents.executeJavaScript("document.querySelector('.scroller').scrollTop=90")
    await new Promise((resolve) => setTimeout(resolve, 80))
    const metrics = await win.webContents.executeJavaScript(`(() => {
      const inputs=[...document.querySelectorAll('li input')], viewport=document.querySelector('.scroller').getBoundingClientRect();
      const covered = inputs.filter(i=>{const r=i.getBoundingClientRect();return r.top>20 && r.bottom<410 && (r.bottom<viewport.top || r.top>viewport.bottom)}).map(i=>{const r=i.getBoundingClientRect();return !!document.elementFromPoint(r.left+8,r.top+8)?.closest('.vessel-task-checkbox')});
      const input=inputs.find(i=>{const r=i.getBoundingClientRect();return r.top>viewport.top+10 && r.bottom<viewport.bottom-10});
      const custom=document.querySelector('button[aria-label="'+input.closest('li').textContent+'"]');
      const n=input.getBoundingClientRect(),c=custom.getBoundingClientRect();
      custom.click();
      const before=custom.getBoundingClientRect().top;document.querySelector('.scroller').scrollTop+=8;
      const immediate=custom.getBoundingClientRect().top;
      return {covered,aligned:Math.abs(n.top-c.top)<1&&Math.abs(n.left-c.left)<1,toggled:input.checked,movesImmediately:Math.abs(before-immediate-8)<1,local:custom.closest('#editor')!==null,savedDOM:!!document.querySelector('.vditor-reset button')};
    })()`)
    assert(metrics.covered.length >= 2 && metrics.covered.every(value => !value), "controls must be clipped beneath both header and footer: " + JSON.stringify(metrics))
    assert(metrics.aligned && metrics.toggled && metrics.movesImmediately && metrics.local && !metrics.savedDOM, JSON.stringify(metrics))
    const screenshot = path.join(directory, "task-checkbox-preview.png")
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG())
    console.log("PASS: editor-local controls, header/footer clipping, immediate scroll alignment and native task toggling")
    console.log("Preview:", screenshot)
    win.destroy()
    app.quit()
  }).catch((error) => { console.error(error); app.exit(1) })
}
