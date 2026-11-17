export function QuickPickerFooter({ action = "打开文件" }: { action?: string }) {
  return <footer className="quick-picker-footer"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>↵</kbd> {action}</span><span className="ml-auto"><kbd>esc</kbd> 关闭</span></footer>
}
