/** Align native library tag leaders using actual layout, including CSS zoom and virtual graph lanes. */
export function syncGitRefLayout(root: HTMLElement, hashes: string[]) {
  const log = root.querySelector<HTMLElement>("#react-git-log")
  const refs = log?.firstElementChild as HTMLElement | null
  if (!log || !refs) return
  const labels = [...refs.querySelectorAll<HTMLElement>('[id^="tag-label-"]')]
  let width = 175
  for (const label of labels) {
    const badges = [...label.parentElement!.children].filter((item): item is HTMLElement => item instanceof HTMLElement && (item === label || item.hasAttribute("data-vessel-head-tag")))
    const required = badges.reduce((total, badge) => total + badge.offsetWidth + parseFloat(getComputedStyle(badge).marginRight || "0"), 24)
    width = Math.max(width, required)
  }
  const size = `${Math.ceil(width)}px`
  if (log.style.getPropertyValue("--vessel-ref-width") !== size) log.style.setProperty("--vessel-ref-width", size)
  // Read again after the ref column grows: this also moves the graph's circles.
  hashes.forEach((hash, index) => {
    const line = refs.querySelector<HTMLElement>(`[id="tag-line-${index}"]`)
    const node = root.querySelector<HTMLElement>(`[id="commit-node-${hash}"]`)
    const container = line?.parentElement
    if (!line || !node || !container) return
    const bounds = container.getBoundingClientRect(), circle = node.getBoundingClientRect()
    const scale = container.offsetWidth ? bounds.width / container.offsetWidth : 0
    if (!scale || !circle.width) return
    const label = container.querySelector<HTMLElement>('[id^="tag-label-"]')
    const start = label?.getBoundingClientRect().right ?? bounds.right
    const left = (start - bounds.left) / scale
    const length = Math.max(0, (circle.left + circle.width / 2 - start) / scale)
    line.style.left = `${left}px`
    line.style.right = "auto"
    line.style.width = `${length}px`
  })
}
