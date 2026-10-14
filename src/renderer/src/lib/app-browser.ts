/** 在活动栏的内置浏览器中打开链接（新标签）。push 为路由跳转函数。 */
export function openInAppBrowser(url: string, push: (path: string) => unknown) {
  sessionStorage.setItem("vessel-browser-pending-url", url)
  window.dispatchEvent(new Event("vessel-browser-open-url"))
  void push("/browser")
}

/** 判断输入是否像一个可访问的链接，返回规范化后的 URL。 */
export function toURL(input: string) {
  const value = input.trim()
  if (!value || /\s/.test(value)) return null
  if (/^(https?|file):\/\//i.test(value)) return value
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(value) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(value)) return `http://${value}`
  return null
}
