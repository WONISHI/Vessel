import { useState } from "react"
import { createRoot } from "react-dom/client"
import { OnlyOfficeEditor } from "wasm-onlyoffice-sdk/react"
import "./assets/main.css"
declare global { interface Window { officeAPI: { save(name: string, bytes: Uint8Array): Promise<boolean> } } }
function Office() {
  const [document, setDocument] = useState<{ file?: File; newDocument?: "docx" | "xlsx" | "pptx"; id: number }>()
  const [status, setStatus] = useState("本地编辑 · 文档不会上传")
  const [dirty, setDirty] = useState(false)
  const open = (value: Omit<NonNullable<typeof document>, "id">) => {
    if (dirty && !confirm("当前文档可能有未保存的修改，仍要切换吗？")) return
    setDirty(false); setStatus("正在加载本地编辑器…"); setDocument({ ...value, id: Date.now() })
  }
  return <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui" }}>
    <header style={{ display: "flex", gap: 16, padding: 12, alignItems: "center", borderBottom: "1px solid #ddd" }}><strong>ONLYOFFICE</strong><label style={{ cursor: "pointer" }}>打开文件<input type="file" accept=".docx,.doc,.odt,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp" style={{ display: "none" }} onChange={event => { const file = event.target.files?.[0]; if (file) open({ file }); event.target.value = "" }} /></label>{(["docx", "xlsx", "pptx"] as const).map((type, i) => <button key={type} onClick={() => open({ newDocument: type })}>{["新建文档", "新建表格", "新建演示"][i]}</button>)}<span style={{ marginLeft: "auto", fontSize: 12 }}>{dirty ? "未保存 · " : ""}{status}</span></header>
    <main style={{ flex: 1, minHeight: 0 }}>{document ? <OnlyOfficeEditor key={document.id} assetsPath="/office/v9.3.0.24-1" x2tPath="/office/x2t" file={document.file} newDocument={document.newDocument} language="zh" user={{ id: "local", name: "本地用户" }} onReady={() => setStatus("使用编辑器的文件 → 另存为保存到本地")} onDocumentStateChange={setDirty} onSave={async (blob, name) => { try { const saved = await window.officeAPI.save(name, new Uint8Array(await blob.arrayBuffer())); setStatus(saved ? "已保存" : "已取消保存"); if (saved) setDirty(false) } catch (error) { setStatus(`保存失败：${String(error)}`) } }} onError={error => setStatus(`加载失败：${error.message}`)} /> : <div style={{ padding: 64, textAlign: "center", color: "#666" }}><h1>本地 Office</h1><p>打开 Word、Excel、PowerPoint 文件，或新建文档开始编辑。</p></div>}</main>
  </div>
}
createRoot(document.getElementById("root")!).render(<Office />)
