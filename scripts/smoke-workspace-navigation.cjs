const { app, BrowserWindow, ipcMain, nativeImage, clipboard } = require("electron")
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
app.setPath("userData", fs.mkdtempSync(path.join(require("node:os").tmpdir(), "vessel-nav-")))

/** Performs the wait operation. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
app
  .whenReady()
  .then(async () => {
    const file = { name: "test.md", path: "/fixture/test.md" },
      state = new Map()
    let reads = 0
    const source =
      "# Workspace fixture\n\n" +
      Array.from({ length: 12 }, (_, i) => `${process.argv.includes("--markdown-edit") && i < 2 ? "1. " : ""}Paragraph ${i}\n\n`).join("") +
      "```js\nconst selected = 123;\nconsole.log(selected);\n```\n\n![[fixture.png]]\n\nEnd\n\n| Name | Value |\n| --- | --- |\n| First | One |\n"
    const rasterImage = nativeImage.createFromBitmap(Buffer.alloc(320 * 180 * 4, 240), { width: 320, height: 180 }).toDataURL()
    const image = process.env.VESSEL_IMAGE_MENU_TEST ? "data:image/svg+xml;base64," + Buffer.from('<svg width="320" height="180"><rect width="320" height="180" fill="red"/></svg>').toString("base64") : rasterImage
    for (const [name, fn] of Object.entries({
      /** Performs the "settings:workspace" operation. */
      "settings:workspace": () => ({ running: false }),

      /** Performs the "settings:status" operation. */
      "settings:status": () => ({ running: false }),

      /** Performs the "settings:get" operation. */
      "settings:get": () => ({ theme: "light", fontSize: 14, accent: "#16a34a" }),

      /** Performs the "markdown:pending" operation. */
      "markdown:pending": () => [],

      /** Performs the "app state:get" operation. */
      "app-state:get": (_e, key) => (key.startsWith("workspace-tabs:") || key.startsWith("resources-tabs:") ? { files: [file], active: file.path } : state.get(key) || null),

      /** Performs the "app state:set" operation. */
      "app-state:set": (_e, key, value) => state.set(key, value),

      /** Performs the "workspace:read directory" operation. */
      "workspace:readDirectory": (_e, _root, parent) =>
        process.argv.includes("--tree-drop") ? (parent === "/fixture/target" ? [{ name: "inside.md", path: "/fixture/target/inside.md" }] : [file, { name: "other.md", path: "/fixture/other.md" }, { name: "target", path: "/fixture/target", type: "directory" }]) : [file],

      /** Performs the "workspace:transfer files" operation. */
      "workspace:transferFiles": (_e, root, paths, destination, external) => {
        state.set("transfer", { paths, destination, external })
        return paths.map((source) => ({ source, target: destination + "/" + source.split("/").pop() }))
      },

      /** Performs the "workspace:mutate file" operation. */
      "workspace:mutateFile": (_e, root, file, name) => {
        state.set("renamed", name)
        state.set("renameCount", (state.get("renameCount") || 0) + 1)
        return root + "/" + name
      },

      /** Performs the "workspace:create entry" operation. */
      "workspace:createEntry": (_e, root, parent, name, kind) => {
        state.set("createCount", (state.get("createCount") || 0) + 1)
        state.set("created", { name, kind })
        return { name, path: parent + "/" + name, type: kind }
      },

      /** Performs the "files:watch" operation. */
      "files:watch": () => "watch",

      /** Performs the "files:unwatch" operation. */
      "files:unwatch": () => {},

      /** Performs the "file:read content" operation. */
      "file:readContent": () => {
        reads++
        return process.env.VESSEL_EMPTY_TEST ? "" : source
      },

      /** Performs the "file:save content" operation. */
      "file:saveContent": (_e, ...args) => {
        state.set("saved", args)
      },

      /** Performs the "obsidian:save image" operation. */
      "obsidian:saveImage": (_e, root, doc, source) => {
        state.set("imageImport", source)
        const name = "Pasted image 20261010145524.png"
        return { name, path: root + "/" + name, reference: "![[" + name + "]]" }
      },

      /** Performs the "image:copy" operation. */
      "image:copy": (_e, value) => state.set("copiedImage", value),

      /** Performs the "obsidian:read image" operation. */
      "obsidian:readImage": () => image,

      /** Performs the "browser:extensions:list" operation. */
      "browser:extensions:list": () => [],

      /** Performs the "browser:proxy:state" operation. */
      "browser:proxy:state": () => ({ connected: false, nodes: [] })
    }))
      ipcMain.handle(name, fn)
    const win = new BrowserWindow({ show: true, width: 1300, height: 850, webPreferences: { preload: path.resolve("out/preload/index.js"), sandbox: false, webviewTag: true } })
    win.webContents.on("console-message", (_e, level, message) => {
      if (level >= 2) console.log(message)
    })

    /** Performs the js operation. */
    const js = (code) => win.webContents.executeJavaScript(code)
    await win.loadFile(path.resolve("out/renderer/index.html"), { hash: "/image" })
    await js(`localStorage.setItem('app_current_workspace',${JSON.stringify(JSON.stringify({ name: "fixture", path: "/fixture", files: [file] }))});location.hash='/editor'`)
    if (process.env.VESSEL_EMPTY_TEST) {
      for (let i = 0; i < 40; i++) {
        await wait(250)
        if (await js(`!!document.querySelector('.vditor-ir [contenteditable=true]')`)) break
      }
      await wait(500)
      const point = await js(`(()=>{const e=document.querySelector('.vditor-ir [contenteditable=true]');const r=e.getBoundingClientRect();return {x:Math.round(r.x+100),y:Math.round(r.y+100),height:r.height}})()`)
      assert(point.height > 200)
      win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x: point.x, y: point.y })
      win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, x: point.x, y: point.y })
      await win.webContents.insertText("New document edit")
      await wait(1200)
      assert(await js(`document.querySelector('.vditor-ir').textContent.includes('New document edit')`))
      assert(JSON.stringify(state.get("saved")).includes("New document edit"))
      console.log("PASS empty Markdown click, type and save")
      app.exit(0)
      return
    }
    for (let i = 0; i < 40; i++) {
      await wait(250)
      if (await js(`!!document.querySelector('.vessel-code-frame')`)) break
    }
    assert(await js(`!!document.querySelector('.vessel-code-frame')`))
    if (process.argv.includes("--tree-drop")) {
      /** Performs the click operation. */
      const click = async (path, mod = "") => js(`document.querySelector('button[title="${path}"]').dispatchEvent(new MouseEvent('click',{bubbles:true,${mod || "detail:1"}}))`)
      await click("/fixture/test.md")
      await click("/fixture/other.md", "metaKey:true")
      await wait(100)
      await js(
        `(()=>{const d=new DataTransfer();document.querySelector('button[title="/fixture/test.md"]').closest('[draggable]').dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:d}));document.querySelector('button[title="/fixture/target"]').closest('[draggable]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:d}))})()`
      )
      await wait(200)
      assert(!state.has("transfer"), "Internal move waits for confirmation")
      assert(await js(`document.querySelector('[role=alertdialog]').textContent.includes('2 个项目')`), "Modifier selection includes both files")
      await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find(b=>b.textContent==='确认移动').click()`)
      await wait(200)
      assert.deepEqual(state.get("transfer"), { paths: ["/fixture/test.md", "/fixture/other.md"], destination: "/fixture/target", external: false })
      await click("/fixture/target")
      await wait(200)
      await js(`(()=>{const d=new DataTransfer();d.setData('application/x-vessel-files',JSON.stringify(['/fixture/other.md']));document.querySelector('button[title="/fixture/target/inside.md"]').closest('[draggable]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:d}))})()`)
      await wait(100)
      await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find(b=>b.textContent==='确认移动').click()`)
      await wait(100)
      assert.equal(state.get("transfer").destination, "/fixture/target", "Dropping on file uses its parent folder")
      console.log("PASS multi-select, confirmed move and file-row destination")
      app.exit(0)
      return
    }
    if (process.argv.includes("--image-import")) {
      /** Performs the caret operation. */
      const caret = async () =>
        js(
          `(()=>{const p=[...document.querySelectorAll('.vditor-ir p')].find(p=>p.textContent.trim()==='Paragraph 3');p.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(p);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r)})()`
        )
      await caret()
      clipboard.writeImage(nativeImage.createFromDataURL(rasterImage))
      win.webContents.paste()
      await wait(1500)
      assert(state.get("imageImport")?.bytes?.length, "Clipboard image sent to root importer")
      assert(state.get("saved")[1].includes("![[Pasted image 20261010145524.png]]"), "Saved document links root attachment")
      assert(!state.get("saved")[1].includes("data:image"), "No embedded clipboard image")
      const server = require("node:http").createServer((_req, res) => {
        res.setHeader("content-type", "image/png")
        res.end(nativeImage.createFromDataURL(rasterImage).toPNG())
      })
      await new Promise((r) => server.listen(0, "127.0.0.1", r))
      const url = "http://127.0.0.1:" + server.address().port + "/image.awebp?x=1#width=300"
      await caret()
      clipboard.writeText("![](" + url + ")")
      win.webContents.paste()
      await wait(1500)
      const selector = '.vessel-image-block:has([title="远程图片"]) img[src^="data:image/png"]'
      await js(`Array.from(document.querySelectorAll('.vessel-image-block')).find(b=>b.querySelector('pre.vditor-ir__marker code')?.textContent.includes('127.0.0.1'))?.scrollIntoView({block:'center'})`)
      for (let i = 0; i < 20; i++) {
        await wait(100)
        if (await js(`!!document.querySelector('${selector}')`)) break
      }
      assert(await js(`!!document.querySelector('${selector}')`), "Remote paste immediately uses image component")
      await js(`document.querySelector('${selector}').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
      await wait(200)
      assert(await js(`!!document.querySelector('[aria-label="关闭图片预览"]')`), "Own preview has icon close control")
      await js(`document.querySelector('[aria-label="旋转图片"]').click();document.querySelector('[aria-label="关闭图片预览"]').click()`)
      await wait(250)
      assert(!(await js(`!!document.querySelector('[aria-label="关闭图片预览"]') || !!document.querySelector('.vditor-img')`)), "Close works without inline handlers")
      await js(`document.querySelector('${selector}').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:600,clientY:400}))`)
      await wait(150)
      await js(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(e=>e.textContent==='下载并替换为本地图片').click()`)
      await wait(1300)
      assert.equal(state.get("imageImport")?.url, url, "Download receives original remote URL")
      assert(!state.get("saved")[1].includes(url), "Download replaces remote reference")
      await js(
        `(()=>{const p=[...document.querySelectorAll('.vditor-ir p')].find(p=>p.textContent.trim()==='Paragraph 5');p.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(p);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r)})()`
      )
      await win.webContents.insertText(" ![](" + url + ")")
      await wait(1500)
      assert(await js(`Array.from(document.querySelectorAll('.vessel-image-block')).some(b=>b.textContent.includes('127.0.0.1'))`), "Typed remote reference becomes component immediately")
      await js(`document.querySelector('.vessel-image-block:has([title="远程图片"])')?.scrollIntoView({block:'center'})`)
      await wait(300)
      await js(`document.querySelector('.vessel-image-block:has([title="远程图片"]) img[decoding]')?.dispatchEvent(new Event('error'))`)
      await wait(100)
      await js(`document.querySelector('.vessel-image-block:has([title="远程图片"]) img')?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`)
      await wait(100)
      assert(!(await js(`!!document.querySelector('[aria-label="关闭图片预览"]') || !!document.querySelector('.vditor-img')`)), "Failed placeholder never opens oversized preview")
      server.close()
      console.log("PASS clipboard attachment, immediate pasted/typed remote image, preview controls, failed placeholder and download replacement")
      app.exit(0)
      return
    }
    if (process.env.VESSEL_MARKDOWN_EDIT_TEST || process.argv.includes("--markdown-edit")) {
      await js(`(()=>{const c=document.querySelector('.vessel-code-frame code');c.closest('[contenteditable=true]').focus();const r=document.createRange();r.setStart(c.firstChild,c.firstChild.textContent.length);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r)})()`)
      await win.webContents.insertText("const inlineEdit = true;")
      await wait(1200)
      assert(JSON.stringify(state.get("saved")).includes("inlineEdit"), "Direct code edit saves")
      win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Enter" })
      win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Enter" })
      await win.webContents.insertText("const nextLine = 2;")
      await wait(1200)
      assert(JSON.stringify(state.get("saved")).includes("nextLine"), "Enter and next code line save")
      await js(`document.querySelector('[data-type="undo"]').click()`)
      await wait(400)
      assert(!(await js(`document.querySelector('.vessel-code-frame code').textContent.includes('nextLine')`)), "Code edit undo works")
      await js(`(()=>{const c=document.querySelector('.vditor-ir td:last-child');c.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(c);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r)})()`)
      clipboard.write({ text: "{remote: string;\nerror: unknown;}[]", html: "<pre><code>{remote: string;\nerror: unknown;}[]</code></pre>" })
      win.webContents.paste()
      await wait(1200)
      assert(await js(`document.querySelector('.vditor-ir td:last-child').textContent.includes('error: unknown;')`), "Code paste stays in cell")
      assert(
        state
          .get("saved")[1]
          .split("\n")
          .some((line) => line.startsWith("|") && line.includes("remote: string;") && line.includes("error: unknown;")),
        "Saved table preserves pasted multiline content"
      )
      assert.equal(await js(`document.querySelectorAll('.vessel-direct-code').length`), 1, "Paste does not create code block")
      for (const background of [false, true]) {
        await js(
          `(()=>{const p=[...document.querySelectorAll('.vditor-ir p')].find(e=>e.textContent.trim()==='Paragraph ${background ? 1 : 0}');p.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);const b=document.querySelector('[data-type="text-colors"]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));b.click()})()`
        )
        await wait(200)
        if (background) await js(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='背景颜色').click()`)
        await js(`document.querySelector('[aria-label="${background ? "背景" : "文字"} #ff4d4f"]').click()`)
        await wait(1200)
        assert(JSON.stringify(state.get("saved")).includes(background ? "background:#ff4d4f" : 'color=\\"#ff4d4f'), "Selected color markup saves")
        assert(await js(`(()=>{const e=document.querySelector('[data-vessel-inline-tag="${background ? "mark" : "font"}"]');return e && getComputedStyle(e).${background ? "backgroundColor" : "color"}==='rgb(255, 77, 79)'})()`), "Color immediately visible without reload")
        await js(
          `(()=>{const p=document.querySelector('[data-vessel-inline-tag="${background ? "mark" : "font"}"]');p.closest('[contenteditable=true]').focus();const r=document.createRange();r.selectNodeContents(p);getSelection().removeAllRanges();getSelection().addRange(r);const b=document.querySelector('[data-type="text-colors"]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));b.click()})()`
        )
        await wait(100)
        if (background) await js(`Array.from(document.querySelectorAll('[role="dialog"] button')).find(e=>e.textContent==='背景颜色').click()`)
        await js(`document.querySelector('[aria-label="取消${background ? "背景" : "文字"}颜色"]').click()`)
        await wait(1200)
        assert(!state.get("saved")[1].includes(background ? "<mark" : "<font"), "Clear color removes only markup")
        assert(state.get("saved")[1].includes("Paragraph " + (background ? 1 : 0)), "Clear preserves selected text")
      }
      await js(`document.querySelector('.vessel-code-frame').scrollIntoView({block:'center'});document.activeElement.blur()`)
      await wait(300)
      assert(await js(`[...CSS.highlights.values()].some(h=>h.size>0)`), "Syntax highlights registered without modifying source")
      assert(await js(`document.querySelector('.vessel-code-frame').getBoundingClientRect().height>80`), "Code card remains visible after blur")
      await js(`(()=>{const p=document.querySelector('.vessel-code-frame');const r=p.getBoundingClientRect();p.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:r.left+80,clientY:r.top+16}))})()`)
      await wait(100)
      await js(`(()=>{const s=document.querySelector('[aria-label="代码语言"]');s.value='ts';s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
      await wait(1200)
      assert(state.get("saved")[1].includes("\u0060\u0060\u0060ts"), "Language change updates saved fence")
      assert(state.get("saved")[1].includes("inlineEdit"), "Language change preserves code")
      assert.equal((state.get("saved")[1].match(/```/g) || []).length, 2, "Language switch does not duplicate block")
      fs.writeFileSync("/tmp/vessel-markdown-edit.png", (await win.webContents.capturePage()).toPNG())
      await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',metaKey:true,bubbles:true}))`)
      await wait(200)
      assert(await js(`!!document.querySelector('[cmdk-root] [cmdk-input]')`), "Command uses shadcn/cmdk")
      await js(`Array.from(document.querySelectorAll('[cmdk-item]')).find(e=>e.textContent==='关闭控制按钮').click()`)
      await wait(100)
      assert.equal(await js(`localStorage.getItem('vessel-control-visible')`), "false")
      assert(await js(`!!document.querySelector('footer[aria-label="底部状态栏"] time')`), "Shared status bar renders clock")
      console.log("PASS code edit/save/undo/highlight, table paste/save, colors, command and status bar")
      app.exit(0)
      return
    }
    if (process.env.VESSEL_OUTLINE_TEST) {
      await js(`document.querySelector('aside[aria-label="文档大纲"]').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
      await wait(500)
      await js(`document.querySelector('button[aria-label="固定大纲"]').click()`)
      await wait(500)
      const point = await js(`(()=>{const b=[...document.querySelectorAll('aside[aria-label="文档大纲"] button')].find(e=>e.textContent==='Workspace fixture');const r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`)
      win.focus()
      win.webContents.focus()
      win.webContents.sendInputEvent({ type: "mouseMove", x: 400, y: 400 })
      await wait(100)
      win.webContents.sendInputEvent({ type: "mouseMove", ...point })
      await wait(500)
      assert(!(await js(`!!document.querySelector('.vessel-hover-preview')`)), "No immediate preview")
      await wait(2000)
      assert(await js(`!!document.querySelector('.vessel-hover-preview')`), "Visible pinned heading opens delayed preview")
      assert(await js(`Number(getComputedStyle(document.querySelector('aside[aria-label="文档大纲"]')).zIndex)>45`), "Outline above table controls")
      win.webContents.sendInputEvent({ type: "mouseMove", x: 400, y: 400 })
      await wait(500)
      console.log("PASS visible outline delayed preview and layer")
      app.exit(0)
      return
    }
    if (process.env.VESSEL_IMAGE_MENU_TEST) {
      await js(`document.querySelector('.vessel-image-block').scrollIntoView({block:'center'})`)
      await wait(700)
      assert(await js(`(()=>{const i=document.querySelector('.vessel-image-block img[src^="data:image/svg"]');return i?.complete && i.naturalWidth===320})()`), "SVG without namespace renders")

      /** Performs the menu operation. */
      const menu = async () => {
        await js(`document.querySelector('.vessel-image-block img[src^="data:image/svg"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:500,clientY:400}))`)
        await wait(200)
      }
      await menu()
      await js(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(e=>e.textContent==='复制').click()`)
      await wait(300)
      assert(state.get("copiedImage")?.startsWith("data:image/svg+xml"), "SVG copy preserves vector MIME")
      await menu()
      await js(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(e=>e.textContent==='在下方聚焦').click()`)
      await wait(300)
      await win.webContents.insertText("Below image text")
      await wait(1200)
      assert(JSON.stringify(state.get("saved")).includes("Below image text"), "Focus below image edits and saves")
      assert(JSON.stringify(state.get("saved")).includes("fixture.png"), "Original image preserved")
      console.log("PASS SVG preview, vector copy, focus below image and save")
      app.exit(0)
      return
    }
    if (process.env.VESSEL_CREATE_TEST) {
      await js(`document.querySelector('button[aria-label="新建文件"]').click()`)
      await wait(200)
      await js(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='新建自定义文件').click()`)
      await wait(200)
      await js(`document.querySelector('[aria-label="新文件名称"]').focus()`)
      await win.webContents.insertText("notes.custom")
      await wait(100)
      await js(`document.querySelector('[aria-label="新文件名称"]').blur()`)
      await wait(300)
      assert.deepEqual(state.get("created"), { name: "notes.custom", kind: "file" })
      assert.equal(state.get("createCount"), 1)
      await js(`document.querySelector('button[aria-label="新建文件"]').click()`)
      await wait(150)
      await js(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='新建自定义文件').click()`)
      await wait(150)
      await js(`document.querySelector('[aria-label="新文件名称"]').blur()`)
      await wait(150)
      assert.equal(await js(`!!document.querySelector('[aria-label="新文件名称"]')`), false)
      assert.equal(state.get("createCount"), 1)

      /** Renames rename. */
      const rename = async () => {
        await js(`document.querySelector('button[title="/fixture/test.md"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:190,clientY:180}))`)
        await wait(150)
        await js(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(e=>e.textContent==='重命名').click()`)
        await wait(200)
        await js(`document.querySelector('[aria-label="文件新名称"]').focus()`)
      }
      await rename()
      await win.webContents.insertText("renamed")
      await wait(100)
      await js(`document.querySelector('[aria-label="文件新名称"]').blur()`)
      await wait(250)
      assert.equal(state.get("renameCount"), undefined, "Rename waits for confirmation")
      await js(`Array.from(document.querySelectorAll('[role=alertdialog] button')).find(e=>e.textContent==='确认重命名').click()`)
      await wait(250)
      assert.equal(state.get("renamed"), "renamed.md")
      assert.equal(state.get("renameCount"), 1)
      await rename()
      await win.webContents.insertText("")
      await js(`(()=>{const i=document.querySelector('[aria-label="文件新名称"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
      await wait(100)
      await js(`document.querySelector('[aria-label="文件新名称"]').blur()`)
      await wait(150)
      assert.equal(await js(`!!document.querySelector('[aria-label="文件新名称"]')`), false)
      assert.equal(state.get("renameCount"), 1)
      console.log("PASS create and rename on blur exactly once; empty names cancel")
      app.exit(0)
      return
    }
    if (process.env.VESSEL_RESOURCE_TEST) {
      /** Performs the choose operation. */
      const choose = async (name) => {
        await js(`localStorage.setItem('resource_current_project',JSON.stringify({name:${JSON.stringify(name)},path:'/'+${JSON.stringify(name)},files:[]}));window.dispatchEvent(new Event('vessel:resource-changed'));location.hash='/resources'`)
        await wait(1000)
      }
      await choose("project-one")
      await wait(800)
      await js(`window.resourceEditor=[...document.querySelectorAll('.vditor')].find(e=>e.getClientRects().length)`)
      assert(await js(`!!window.resourceEditor`))
      await choose("project-two")
      const count = reads
      await choose("project-one")
      assert(await js(`window.resourceEditor===[...document.querySelectorAll('.vditor')].find(e=>e.getClientRects().length)`))
      assert.equal(reads, count)
      console.log("PASS resource project switch retains editor and does not reread file")
      app.exit(0)
      return
    }
    await js(`window.fixtureEditor=document.querySelector('.vditor');window.fixtureFrame=document.querySelector('.vessel-code-frame')`)
    await js(`document.querySelector('.vditor-ir table').scrollIntoView({block:'center'})`)
    await wait(200)

    /** Performs the table hover operation. */
    const tableHover = async (edge) => {
      const point = await js(
        `(()=>{const t=document.querySelector('.vditor-ir table');const cells=[...t.querySelectorAll('th,td')].map(c=>c.getBoundingClientRect());const r={left:Math.min(...cells.map(c=>c.left)),right:Math.max(...cells.map(c=>c.right)),top:Math.min(...cells.map(c=>c.top)),bottom:Math.max(...cells.map(c=>c.bottom))};return {x:Math.round(${edge == "row" ? "r.left+50" : "r.right+8"}),y:Math.round(${edge == "row" ? "r.bottom+8" : "r.top+20"})}})()`
      )
      win.focus()
      win.webContents.focus()
      win.webContents.sendInputEvent({ type: "mouseMove", x: 400, y: 100 })
      await wait(100)
      win.webContents.sendInputEvent({ type: "mouseMove", ...point })
      await wait(300)
      win.webContents.sendInputEvent({ type: "mouseMove", x: point.x + 1, y: point.y })
      await wait(100)
      assert(await js(`(()=>{const b=document.querySelector('[aria-label="${edge == "row" ? "在下方新增行" : "在右侧新增列"}"]');return !b.hidden&&b.getBoundingClientRect().width>0})()`), "edge add control is visible")
      await js(`document.querySelector('[aria-label="${edge == "row" ? "在下方新增行" : "在右侧新增列"}"]').click()`)
      await wait(200)
    }
    await tableHover("row")
    assert.equal(await js(`document.querySelector('.vditor-ir table').rows.length`), 3)
    await tableHover("column")
    assert.equal(await js(`document.querySelector('.vditor-ir table').rows[0].cells.length`), 3)
    console.log("PASS Markdown table edge add row and column")
    const before = reads

    /** Performs the activity operation. */
    const activity = async (label) => {
      await js(`Array.from(document.querySelectorAll('nav[aria-label="工作台活动栏"] button')).find(e=>e.getAttribute("aria-label")===${JSON.stringify(label)}&&e.getClientRects().length).click()`)
      await wait(400)
    }
    await activity("图片")
    await activity("开发工具")
    assert.equal(await js(`location.hash`), "#/devtools/json")
    assert.equal(await js(`getComputedStyle(document.querySelector('.dev-tools aside')).backgroundColor`), "rgb(250, 250, 249)")
    await activity("工作区")
    await wait(300)
    assert(await js(`window.fixtureEditor===document.querySelector('.vditor')`), "editor survives activity navigation")
    assert.equal(reads, before, "returning does not reload file")
    await js(`document.querySelector('.vessel-code-frame').scrollIntoView({block:'center'})`)
    const rect = await js(`(()=>{const r=document.querySelector('.vessel-code-frame code').getBoundingClientRect();return {x:r.x+2,y:r.y+8,end:r.right-10}})()`)
    win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x: Math.round(rect.x), y: Math.round(rect.y) })
    win.webContents.sendInputEvent({ type: "mouseMove", modifiers: ["leftButtonDown"], x: Math.round(Math.min(rect.x + 200, rect.end)), y: Math.round(rect.y + 22) })
    win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, x: Math.round(Math.min(rect.x + 200, rect.end)), y: Math.round(rect.y + 22) })
    await wait(200)
    assert((await js("getSelection().toString()")).length > 0, "code supports mouse selection")
    win.webContents.copy()
    await wait(100)
    assert(clipboard.readText().includes("selected"))
    await js(`document.querySelector('.vessel-image-block').scrollIntoView({block:'center'})`)
    await wait(500)
    const imageRect = await js(`(()=>{const i=document.querySelector('.vessel-image-block img[decoding]');const r=i.getBoundingClientRect();window.scrollHost=i.closest('.vditor-ir');window.oldScroll=scrollHost.scrollTop;return {x:r.x+20,y:r.y+20}})()`)
    win.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, x: Math.round(imageRect.x), y: Math.round(imageRect.y) })
    win.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, x: Math.round(imageRect.x), y: Math.round(imageRect.y) })
    await wait(200)
    assert(await js(`Math.abs(scrollHost.scrollTop-oldScroll)<50`), "image click preserves scroll")
    await js(`document.querySelector('.vessel-image-block img[decoding]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:600,clientY:400}))`)
    await wait(150)
    assert.equal(await js(`document.querySelectorAll('[role=menuitem]').length`), 9)
    await js(`Array.from(document.querySelectorAll('[role=menuitem]')).find(e=>e.textContent==='压缩').click()`)
    await wait(300)
    assert(await js(`Array.from(document.querySelectorAll('.image-tool-nav button[aria-pressed=true]')).some(e=>e.getClientRects().length && e.textContent.trim()==='压缩')`))
    console.log("PASS workspace retained/no reread, image→tools route/sidebar, code drag/copy, image scroll/context toolbox")
    app.exit(0)
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
setTimeout(() => app.exit(1), 30000).unref()
