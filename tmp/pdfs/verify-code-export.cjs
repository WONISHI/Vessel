const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const esbuild = require('node:module').createRequire(require.resolve('vite/package.json'))('esbuild');
const { chromium } = require('/Users/weizhifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
require('vditor/dist/js/lute/lute.min.js');
const { window } = new JSDOM('<!doctype html><body></body>');
global.document = window.document;
const load = (path) => {
  const result = esbuild.buildSync({ entryPoints: [path], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
};
const { printableMarkdown } = load('src/renderer/src/components/native-file-menu/document-bridge.ts');
const { preparePdfExport } = load('src/main/menu/pdf-options.ts');
let markdown = fs.readFileSync('/Users/weizhifeng/Desktop/obsidian/面试经验复盘/vue面试题.md', 'utf8');
markdown = markdown.replace('![[Pasted image 20261026214252.webp]]', '![](data:image/webp;base64,' + fs.readFileSync('/Users/weizhifeng/Desktop/obsidian/Pasted image 20261026214252.webp').toString('base64') + ')');
const lute = global.Lute.New();
lute.SetYamlFrontMatter(false);
const root = document.createElement('div');
root.innerHTML = lute.Md2VditorIRDOM(markdown);
const before = root.querySelectorAll('[data-type="code-block"]').length;
// Reproduce the real read-only export structure, including the unwanted Vditor copy control.
root.querySelectorAll('[data-type="code-block"]').forEach((block) => {
  const preview = document.createElement('pre');
  preview.className = 'vditor-ir__preview vessel-code-frame';
  preview.innerHTML = '<div class="vditor-copy"><textarea></textarea><svg viewBox="0 0 24 24"><path d="M0 0h24v24"/></svg></div><code>preview duplicate</code>';
  block.append(preview);
});
const prepared = preparePdfExport(printableMarkdown(root), { paper: 'A4', landscape: false, marginMm: 18, fontSize: 14, printBackground: true, pageNumbers: false });
const parsed = new JSDOM(prepared.html).window.document;
if (parsed.querySelector('.vditor-copy,textarea,[data-type="code-block-open-marker"]')) throw new Error('Editor controls leaked into print HTML');
if (parsed.querySelectorAll('pre > code').length !== before) throw new Error('Code blocks were lost');
fs.writeFileSync('tmp/pdfs/vue-fixed.html', prepared.html);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(prepared.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.locator('pre').evaluateAll((blocks) => blocks.map((node) => ({ width: node.getBoundingClientRect().width, scroll: node.scrollWidth, font: getComputedStyle(node).fontFamily })));
    if (metrics.some((m) => m.scroll > m.width + 2)) throw new Error('A code block overflows its width');
    fs.mkdirSync('output/pdf', { recursive: true });
    await page.pdf({ path: 'output/pdf/vue面试题-修复版.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
    console.log(JSON.stringify({ codeBlocks: before, images: parsed.querySelectorAll('img').length, overflowingCodeBlocks: 0, output: 'output/pdf/vue面试题-修复版.pdf' }));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
