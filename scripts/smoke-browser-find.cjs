/* eslint-disable @typescript-eslint/no-require-imports */
// Use a separate watchdog: the native regression blocks Electron's main event loop.
const fs = require("node:fs")
const path = require("node:path")
const assert = require("node:assert/strict")
if (!process.argv.includes("--electron")) {
  const { spawn } = require("node:child_process")
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require("electron"), [__filename, "--electron", ...process.argv.slice(2)], { env, stdio: "inherit" })
  const watchdog = setTimeout(() => {
    console.error("FAIL: find-in-page blocked Electron for 20 seconds")
    child.kill("SIGKILL")
  }, 20000)
  child.on("exit", (code) => { clearTimeout(watchdog); process.exitCode = code ?? 1 })
} else {
  const { app, BrowserWindow } = require("electron")
  app.setPath("userData", fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-find-")))
  app.whenReady().then(async () => {
    const host = new BrowserWindow({ show: false, webPreferences: { webviewTag: true } })
    const fixture = '<p>Alert alert <span>al</span><b>ert</b></p><p hidden>alert</p><p>lit.*eral 中文检索</p><p>sepa<br>rate</p><button id="click-test">click</button><script>const alertText = "alert"; document.getElementById("click-test").onclick = () => window.clicked = true</script>'
    const url = "data:text/html;charset=utf-8," + encodeURIComponent(fixture)
    const attached = new Promise((resolve) => host.webContents.once("did-attach-webview", (_event, guest) => resolve(guest)))
    await host.loadURL("data:text/html," + encodeURIComponent(`<iframe src="about:blank" hidden></iframe><webview src="${url.replace(/"/g, "&quot;")}" style="width:800px;height:600px"></webview><iframe src="about:blank" hidden></iframe>`))
    const guest = await attached
    guest.on("console-message", (event) => { if (event.level === "error") console.error("guest:", event.message) })
    if (guest.isLoading()) await new Promise((resolve) => guest.once("did-stop-loading", resolve))
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (process.argv.includes("--native")) {
      console.log(`Testing original native path on Electron ${process.versions.electron}`)
      for (let index = 0; index < 5; index++) {
        const found = new Promise((resolve) => guest.on("found-in-page", function listener(_event, result) {
          if (result.finalUpdate) { guest.removeListener("found-in-page", listener); resolve(result) }
        }))
        guest.findInPage("alert", { findNext: index === 0 })
        console.log("native result", await found)
      }
    } else {
      const module = { exports: {} }
      const source = fs.readFileSync(path.resolve("src/renderer/src/pages/browser/guest-find.ts"), "utf8")
      // Exercise the serialized function after production-style minification too.
      const requireFromVite = require("node:module").createRequire(require.resolve("vite/package.json"))
      new Function("module", "exports", requireFromVite("esbuild").transformSync(source, { loader: "ts", format: "cjs", target: "chrome142", minify: true }).code)(module, module.exports)
      const find = (text, options) => guest.executeJavaScript(module.exports.guestFindScript(text, options))
      const originalBody = await guest.executeJavaScript("document.body.innerHTML")
      assert.deepEqual(await find("alert"), { activeMatchOrdinal: 1, matches: 3 })
      for (let index = 0; index < 12; index++) assert.equal((await find("alert", { next: true })).activeMatchOrdinal, (index + 1) % 3 + 1)
      assert.equal((await find("alert", { next: true, forward: false })).activeMatchOrdinal, 3)
      assert.deepEqual(await find("Alert", { matchCase: true }), { activeMatchOrdinal: 1, matches: 1 })
      assert.deepEqual(await find("missing"), { activeMatchOrdinal: 0, matches: 0 })
      assert.equal((await find("lit.*eral")).matches, 1)
      assert.equal((await find("中文检索")).matches, 1)
      assert.equal((await find("separate")).matches, 0)
      await guest.executeJavaScript('document.querySelector("p").append(" alert")')
      assert.equal((await find("alert")).matches, 4)
      await guest.executeJavaScript('document.querySelector("p").lastChild.remove()')
      assert.equal((await find("alert", { next: true })).matches, 3)
      assert.equal(await guest.executeJavaScript("document.body.innerHTML"), originalBody)
      await guest.executeJavaScript('document.getElementById("click-test").click()')
      assert.equal(await guest.executeJavaScript("window.clicked"), true)
      assert.deepEqual(await find(""), { activeMatchOrdinal: 0, matches: 0 })
      assert.equal(await guest.executeJavaScript('CSS.highlights.has("vessel-find-all")'), false)
      assert.equal(await host.webContents.executeJavaScript("1 + 1"), 2)
      console.log(`PASS: Electron ${process.versions.electron}, host iframes, inline text, hidden text, wraparound, reverse, case, no results and cleanup`)
    }
    host.destroy()
    app.quit()
  }).catch((error) => { console.error(error); app.exit(1) })
}
