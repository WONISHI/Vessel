/** 只修饰代码预览，不向可编辑源文插入标题文字。 */
export function decorateCodeBlocks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".vditor-ir__preview pre").forEach((pre) => {
    const code = pre.querySelector("code")
    if (!code || pre.closest(".vessel-image-block")) return
    const language =
      Array.from(code.classList)
        .find((name) => name.startsWith("language-"))
        ?.slice(9) || "text"
    if (language === "vessel-obsidian-image") return
    if (pre.dataset.language !== language) pre.dataset.language = language
    pre.classList.add("vessel-code-frame")
  })
}
