/** 只修饰代码预览，不向可编辑源文插入标题文字。 */
export function decorateCodeBlocks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("pre.vditor-ir__preview, .vditor-ir__preview pre").forEach((pre) => {
    const code = pre.querySelector("code")
    if (!code || pre.closest(".vessel-image-block")) return
    const language =
      Array.from(code.classList)
        .find((name) => name.startsWith("language-"))
        ?.slice(9) || "text"
    if (language === "vessel-obsidian-image") return
    if (pre.dataset.language !== language) pre.dataset.language = language
    pre.classList.add("vessel-code-frame")
    // Keep preview selection out of Vditor's click-to-expand/source-caret handlers.
    pre.onmousedown = event => event.stopPropagation()
    pre.onmouseup = event => event.stopPropagation()
    pre.onclick = event => event.stopPropagation()
    pre.oncopy = event => {
      const selection = window.getSelection()
      if (!selection || !pre.contains(selection.anchorNode) || !pre.contains(selection.focusNode)) return
      event.stopPropagation()
      event.preventDefault()
      event.clipboardData?.setData("text/plain", selection.toString())
    }
  })
}
