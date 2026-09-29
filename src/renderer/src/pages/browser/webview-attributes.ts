// Electron 要求实际存在该属性；React 会丢弃未知属性的布尔 true，必须传字符串。
// React 的 WebView 类型仍将其声明为 boolean，因此只在这个边界转换类型。
export const webviewAttributes = {
  partition: "persist:vessel-browser",
  allowpopups: "true" as unknown as boolean
}
