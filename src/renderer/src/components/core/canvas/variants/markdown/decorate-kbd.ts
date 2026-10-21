import { parseKeyboardShortcuts } from "@vessel/obsidian"
import { createElement, Fragment } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

/** 给即时编辑正文中的快捷键添加 Kbd 样式；只包装文本，保留 Markdown 原始字符。 */
export function decorateKeyboardShortcuts(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (
      !node.parentElement?.closest(
        'pre:not(.vditor-reset),code,a,[data-type="code-block"],.vditor-ir__marker,[data-vessel-kbd]'
      )
    ) {
      nodes.push(node)
    }
  }

  const selection = window.getSelection()
  const isFocusedInEditor = root.contains(document.activeElement)

  for (const node of nodes) {
    if (isFocusedInEditor && selection && (node === selection.anchorNode || node === selection.focusNode)) {
      continue
    }

    const text = node.data
    const matches = parseKeyboardShortcuts(text)
    if (!matches.length) continue

    const fragment = document.createDocumentFragment()
    let offset = 0
    for (const match of matches) {
      fragment.append(document.createTextNode(text.slice(offset, match.start)))
      const template = document.createElement("template")
      template.innerHTML = renderToStaticMarkup(
        createElement(
          KbdGroup,
          {
            "aria-label": match.raw,
            className: "mx-1 align-baseline inline-flex items-center gap-1 select-none",
            "data-vessel-kbd": "true"
          } as any,
          match.keys.map((key, index) =>
            createElement(
              Fragment,
              { key: index },
              index > 0
                ? createElement(
                    "span",
                    {
                      "aria-hidden": "true",
                      className: "text-[10px] text-stone-400 dark:text-stone-500 font-medium select-none mx-0.5"
                    },
                    " + "
                  )
                : null,
              createElement(Kbd, { className: "select-none" }, key)
            )
          )
        )
      )
      const kbdElement = template.content.firstChild!
      fragment.append(kbdElement)
      offset = match.end
    }
    fragment.append(document.createTextNode(text.slice(offset)))
    node.replaceWith(fragment)
  }
}
