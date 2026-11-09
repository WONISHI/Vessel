import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ApiDialog, primaryButton } from "@/pages/postman/components/api-dialog"
import { Check, CircleQuestionMark, Copy } from "lucide-react"
import { useState, type ReactNode } from "react"

/** Copyable code sample. */
function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative my-2">
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">{children.trim()}</pre>
      <button type="button" aria-label="复制代码" className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100" onClick={() => { void navigator.clipboard.writeText(children.trim()); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
        {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">{children}</code>

/** API reference table: signature + description. */
function Api({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="my-2 overflow-hidden rounded-md border">
      {rows.map(([signature, description]) => (
        <div key={signature} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)] border-b last:border-b-0">
          <code className="break-all border-r bg-muted/40 px-2.5 py-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">{signature}</code>
          <div className="px-2.5 py-1.5 leading-relaxed">{description}</div>
        </div>
      ))}
    </div>
  )
}

const H = ({ children }: { children: ReactNode }) => <h4 className="mb-1 mt-4 text-[12px] font-semibold">{children}</h4>
const P = ({ children }: { children: ReactNode }) => <p className="my-1.5 leading-relaxed text-muted-foreground">{children}</p>
const Note = ({ children }: { children: ReactNode }) => <div className="my-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">{children}</div>

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "overview",
    title: "概览与执行顺序",
    body: <>
      <P>每个请求可以带两段 JavaScript 脚本：<b>Pre-request</b>（前置脚本）和 <b>Tests</b>（测试脚本）。点击「发送」后的完整流程：</P>
      <ol className="my-2 list-decimal space-y-1 pl-5 leading-relaxed">
        <li>取出当前选中环境的变量（右上角环境下拉框）。</li>
        <li>执行 <b>Pre-request</b> 脚本：可以读写环境变量、修改请求的 URL / 方法 / 请求头。</li>
        <li>用变量替换 URL、参数、请求头、Body、Auth 中的 <C>{"{{变量名}}"}</C>（所以前置脚本里设置的变量，本次请求立即生效）。</li>
        <li>添加 Auth 生成的请求头、自动携带 Cookie，然后发出请求。</li>
        <li>收到响应后执行 <b>Tests</b> 脚本：可以断言响应、把响应数据写入环境变量。</li>
        <li>两段脚本对环境变量的修改会自动保存到当前环境；测试结果显示在响应区「Tests」，日志显示在「控制台」。</li>
      </ol>
      <P>快捷键：<C>⌘/Ctrl + Enter</C> 发送，<C>⌘/Ctrl + S</C> 保存；在 URL 输入框粘贴 cURL 命令会自动解析成完整请求。</P>
    </>
  },
  {
    id: "variables",
    title: "环境变量与 {{变量}}",
    body: <>
      <P>在「环境」标签或右上角的眼睛按钮里编辑变量。请求的 URL、Params、Headers、Body、Auth 中都可以写 <C>{"{{变量名}}"}</C>，发送时自动替换。</P>
      <P>输入框里已定义的变量显示为<span className="api-var-known rounded-sm px-0.5">橙色</span>，未定义的显示为<span className="api-var-unknown rounded-sm px-0.5">红色波浪线</span>，鼠标悬停可看到变量的当前值。未定义的变量会原样保留在请求中。</P>
      <Note>脚本修改的变量只会保存到当前选中的环境。选择「无环境」时修改不会保存，界面会提示。所有变量值都按字符串保存，数字、布尔值会被转成字符串。</Note>
    </>
  },
  {
    id: "pre-request",
    title: "Pre-request 前置脚本",
    body: <>
      <P>在请求发出前执行。典型用途：生成时间戳 / 随机数、根据变量计算参数、动态添加请求头、给请求打日志。</P>
      <H>在前置脚本里能看到什么</H>
      <ul className="my-1.5 list-disc space-y-1 pl-5 leading-relaxed">
        <li><C>pm.request.url</C>：URL 输入框中的原始文本（包含查询参数，<b>尚未</b>替换 <C>{"{{变量}}"}</C>）。</li>
        <li><C>pm.request.headers</C>：Headers 标签里已启用的请求头（原始文本）。Auth 生成的 Authorization、自动携带的 Cookie 在脚本之后才添加，这里看不到。</li>
        <li><C>pm.response</C> 不存在：此时还没有响应，访问会报错。需要读取响应请写在 Tests 里。</li>
      </ul>
      <H>示例：时间戳 + 请求 ID</H>
      <Code>{`
pm.environment.set("timestamp", Date.now().toString())
pm.request.headers.add({ key: "X-Request-Id", value: Math.random().toString(36).slice(2) })
// 之后在 Params 里使用 ts = {{timestamp}}
`}</Code>
      <H>示例：按环境切换路径前缀</H>
      <Code>{`
if (pm.environment.get("env") === "prod") {
  pm.request.url = pm.request.url.replace("/v1/", "/v2/")
}
`}</Code>
      <H>示例：没有 token 时提醒</H>
      <Code>{`
if (!pm.environment.has("token")) {
  console.warn("当前环境没有 token，请先调用登录接口")
}
`}</Code>
    </>
  },
  {
    id: "tests",
    title: "Tests 测试脚本",
    body: <>
      <P>在收到响应后执行。典型用途：断言状态码 / 响应时间 / 字段值，把响应中的 token、id 保存成环境变量供后续请求使用。</P>
      <P>每个 <C>pm.test(名称, 函数)</C> 是一条独立断言：函数正常执行完为 PASS，抛出错误为 FAIL，一条失败不影响其他条。</P>
      <H>示例：常用断言</H>
      <Code>{`
pm.test("状态码为 200", () => {
  pm.response.to.have.status(200)
})

pm.test("响应时间小于 500ms", () => {
  pm.expect(pm.response.responseTime).to.be.below(500)
})

pm.test("返回了用户列表", () => {
  const json = pm.response.json()
  pm.expect(json).to.be.an("array")
  pm.expect(json).to.not.be.empty
  pm.expect(json[0]).to.have.property("id")
})
`}</Code>
      <H>示例：保存登录 token（最常用）</H>
      <Code>{`
const json = pm.response.json()
if (pm.response.code === 200 && json.data?.token) {
  pm.environment.set("token", json.data.token)
  pm.environment.set("userId", json.data.user.id)
}
// 其他请求：Auth 选 Bearer Token，填 {{token}}
`}</Code>
      <H>示例：从响应头 / 纯文本中取值</H>
      <Code>{`
pm.environment.set("sessionId", pm.response.headers.get("X-Session-Id"))

const match = pm.response.text().match(/csrf_token" value="(\\w+)"/)
if (match) pm.environment.set("csrf", match[1])
`}</Code>
      <Note>请求失败（网络错误、超时、URL 无效）时 Tests 仍会执行：此时 <C>pm.response.code</C> 为 0，<C>pm.response.text()</C> 是错误信息。图片等二进制响应在 Tests 中 <C>text()</C> 为空字符串。</Note>
    </>
  },
  {
    id: "pm-environment",
    title: "pm.environment / pm.variables",
    body: <>
      <P>读写当前环境的变量。<C>pm.variables</C> 与 <C>pm.environment</C> 完全相同，是为了兼容 Postman 写法的别名。</P>
      <Api rows={[
        ["get(key)", <>读取变量，不存在时返回 <C>undefined</C>。</>],
        ["set(key, value)", <>设置变量；<C>value</C> 会被转成字符串。修改立即对后续脚本和本次请求的变量替换生效，并保存到当前环境。</>],
        ["unset(key)", "删除变量（从当前环境中移除）。"],
        ["has(key)", <>是否存在该变量，返回 <C>true</C> / <C>false</C>。</>],
        ["toObject()", <>返回所有变量的副本，如 <C>{'{ baseUrl: "https://…", token: "…" }'}</C>。</>],
        ["replaceIn(text)", <>把文本中的 <C>{"{{变量}}"}</C> 替换为当前值，未定义的保持原样。</>]
      ]} />
      <Code>{`
const base = pm.environment.get("baseUrl")
pm.environment.set("page", 2)            // 保存为 "2"
pm.environment.unset("tempToken")
console.log(pm.environment.has("token"))  // true / false
console.log(pm.variables.replaceIn("{{baseUrl}}/users"))
`}</Code>
    </>
  },
  {
    id: "pm-request",
    title: "pm.request",
    body: <>
      <P>当前请求。在 Pre-request 中修改会影响即将发出的请求；在 Tests 中是<b>实际发出的最终请求</b>（变量已替换、包含 Auth 与 Cookie 头），只读意义。</P>
      <Api rows={[
        ["method", <>请求方法，可赋值：<C>{'pm.request.method = "POST"'}</C>（自动转大写）。</>],
        ["url", <>完整 URL 字符串（含查询参数），可赋值修改。</>],
        ["headers.add({ key, value })", "添加请求头（同名时覆盖同一个大小写的键）。"],
        ["headers.upsert({ key, value })", "存在则更新（忽略大小写匹配），不存在则添加。"],
        ["headers.remove(key)", "删除请求头（忽略大小写）。"],
        ["headers.get(key)", "读取请求头的值（忽略大小写），不存在返回 undefined。"],
        ["headers.has(key)", "是否存在该请求头（忽略大小写）。"],
        ["headers.toObject()", "返回所有请求头的普通对象副本。"]
      ]} />
      <Code>{`
pm.request.headers.upsert({ key: "Accept-Language", value: "zh-CN" })
pm.request.headers.remove("X-Debug")
pm.request.url += (pm.request.url.includes("?") ? "&" : "?") + "_t=" + Date.now()
`}</Code>
    </>
  },
  {
    id: "pm-response",
    title: "pm.response（仅 Tests）",
    body: <>
      <Api rows={[
        ["code", <>HTTP 状态码数字，如 <C>200</C>；请求失败时为 <C>0</C>。</>],
        ["status", <>状态文本，如 <C>{'"OK"'}</C>、<C>{'"Not Found"'}</C>。</>],
        ["responseTime", "耗时（毫秒）。"],
        ["headers.get(name)", "读取响应头（忽略大小写）。同样支持 has / toObject。"],
        ["text()", "响应体原始文本。"],
        ["json()", "把响应体解析为 JSON；不是合法 JSON 时抛错（写在 pm.test 中会显示为 FAIL）。"],
        ["to.have.status(code)", <>断言状态码，参数可以是数字 <C>200</C> 或状态文本 <C>{'"OK"'}</C>。</>],
        ["to.have.header(name)", "断言存在某个响应头。"],
        ["to.be.ok", <>断言状态码为 2xx。这是属性不是函数，<b>不要加括号</b>。</>]
      ]} />
      <Code>{`
pm.test("创建成功", () => {
  pm.response.to.have.status(201)
  pm.response.to.have.header("Location")
})
pm.test("2xx", () => { pm.response.to.be.ok })
console.log(pm.response.code, pm.response.status, pm.response.responseTime + "ms")
`}</Code>
    </>
  },
  {
    id: "pm-test",
    title: "pm.test",
    body: <>
      <Api rows={[["test(name, fn)", <>注册并立即执行一条测试。<C>fn</C> 中抛出任何错误（包括 <C>pm.expect</C> 断言失败）记为 FAIL，并显示错误信息；否则记为 PASS。</>]]} />
      <P>写在 Pre-request 里的 <C>pm.test</C> 同样会计入结果。不在 <C>pm.test</C> 里的代码一旦报错，脚本会停止，并出现一条名为「Pre-request Script」或「Script Execution」的失败记录。</P>
    </>
  },
  {
    id: "pm-expect",
    title: "pm.expect 断言",
    body: <>
      <P>链式写法，接近 Chai。<C>to</C>、<C>be</C>、<C>been</C>、<C>is</C>、<C>that</C>、<C>which</C>、<C>and</C>、<C>has</C>、<C>have</C>、<C>with</C>、<C>deep</C> 只是让语句通顺的连接词，可以任意组合或省略；<C>not</C> 会把后面的断言取反。</P>
      <Api rows={[
        ["equal(v) / eq(v)", <>严格相等（<C>===</C>）。</>],
        ["eql(v)", "深度相等（按 JSON 序列化比较，对象键的顺序也需一致）。"],
        ["include(v) / contain(v)", "字符串包含子串；数组包含某个元素（深度比较）。"],
        ["property(key[, value])", "对象拥有某个键；传了 value 时还要求该键的值深度相等。"],
        ["lengthOf(n)", "字符串 / 数组长度等于 n。"],
        ["above(n) / below(n)", "大于 / 小于 n。"],
        ["oneOf([a, b, …])", "值是列表中的某一个。"],
        ["a(type) / an(type)", <>类型判断：<C>{'"string"'}</C> <C>{'"number"'}</C> <C>{'"boolean"'}</C> <C>{'"object"'}</C> <C>{'"array"'}</C> <C>{'"null"'}</C> <C>{'"undefined"'}</C>。</>],
        [".true / .false", <>严格等于 true / false（属性，不加括号）。</>],
        [".ok", "为真值（非 0、非空字符串、非 null / undefined）。"],
        [".null / .undefined", "严格等于 null / undefined。"],
        [".empty", <>空字符串、空数组或没有键的对象。</>],
        [".not", "对后续断言取反。"]
      ]} />
      <Code>{`
const json = pm.response.json()
pm.expect(json.code).to.equal(0)
pm.expect(json.data).to.be.an("object").and.not.be.empty
pm.expect(json.data).to.have.property("status", "active")
pm.expect(json.data.tags).to.include("vip")
pm.expect(json.data.tags).to.have.lengthOf(3)
pm.expect(json.data.role).to.be.oneOf(["admin", "editor"])
pm.expect(json.data.deletedAt).to.be.null
pm.expect(json.data.enabled).to.be.true
pm.expect(json.message).to.not.include("error")
pm.expect(json.data.meta).to.eql({ page: 1, size: 20 })
`}</Code>
    </>
  },
  {
    id: "console",
    title: "console 日志",
    body: <>
      <Api rows={[
        ["console.log(...args)", "普通日志。"],
        ["console.info(...args)", <>带 <C>[info]</C> 前缀。</>],
        ["console.warn(...args)", <>带 <C>[warn]</C> 前缀，橙色显示。</>],
        ["console.error(...args)", <>带 <C>[error]</C> 前缀，红色显示。</>]
      ]} />
      <P>对象会自动转成 JSON 文本。日志显示在响应区的「控制台」标签中，同时还能看到实际发出的请求（方法、最终 URL、全部请求头）和本次脚本修改过的变量。</P>
    </>
  },
  {
    id: "runner",
    title: "集合批量运行",
    body: <>
      <P>在集合或文件夹上点 ▶（或右键「运行」），会按树中的顺序依次发送其中所有请求（包含子文件夹），每个请求都执行自己的 Pre-request 和 Tests。</P>
      <P>前一个请求的脚本设置的变量，后面的请求立即可用。常见做法是把「登录」放在第一个，在它的 Tests 里保存 token，后续请求用 <C>{"{{token}}"}</C>。运行结束后显示每个请求的通过情况，变量修改会保存到当前环境。</P>
      <P>判定规则：请求有测试时，全部测试通过才算 PASS；没有测试时，状态码为 2xx / 3xx 即算 PASS。</P>
    </>
  },
  {
    id: "limits",
    title: "限制与注意事项",
    body: <>
      <ul className="my-1.5 list-disc space-y-1.5 pl-5 leading-relaxed">
        <li>脚本必须是<b>同步</b>代码，单次执行超过 <b>2 秒</b>会被中止并记为失败。<C>setTimeout</C>、<C>await</C> 之后的代码、Promise 回调中的结果不会被等待。</li>
        <li>可以使用 JavaScript 内置对象：<C>JSON</C>、<C>Math</C>、<C>Date</C>、<C>RegExp</C>、<C>Array</C>、<C>encodeURIComponent</C> 等；不支持 <C>require</C>、<C>fetch</C>、<C>pm.sendRequest</C>、<C>crypto</C>、<C>atob/btoa</C>，也不支持 Postman 的 <C>pm.globals</C>、<C>pm.collectionVariables</C>、<C>pm.cookies</C>。</li>
        <li>环境变量的值始终是字符串，读取数字时请自行转换：<C>{'Number(pm.environment.get("page"))'}</C>。</li>
        <li>脚本运行在本机，可访问的能力受限，但并不是安全沙箱，请只运行你信任的脚本（例如导入别人的集合时先检查其中的脚本）。</li>
      </ul>
    </>
  }
]

/** In-app manual for scripts, variables and the full pm API. */
export function ApiHelpDialog({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(SECTIONS[0].id)
  const go = (id: string) => {
    setActive(id)
    document.getElementById(`api-help-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }
  return (
    <ApiDialog onClose={onClose} icon={CircleQuestionMark} title="使用说明" description="Pre-request / Tests 脚本、环境变量与 pm 对象完整参考" className="max-w-[920px]" footer={<Button type="button" size="sm" className={primaryButton} onClick={onClose}>知道了</Button>}>
      <div className="-mx-5 -my-4 grid h-[68vh] grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="说明目录" className="space-y-0.5 overflow-y-auto border-r p-2">
          {SECTIONS.map((section) => (
            <button key={section.id} type="button" onClick={() => go(section.id)} className={`block w-full truncate rounded px-2 py-1.5 text-left ${active === section.id ? "bg-amber-50 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {section.title}
            </button>
          ))}
        </nav>
        <ScrollArea type="hover" className="h-full min-h-0">
          <div className="space-y-6 px-5 py-4">
            {SECTIONS.map((section) => (
              <section key={section.id} id={`api-help-${section.id}`} className="scroll-mt-2">
                <h3 className="mb-1.5 border-b pb-1.5 text-[13px] font-semibold">{section.title}</h3>
                {section.body}
              </section>
            ))}
          </div>
        </ScrollArea>
      </div>
    </ApiDialog>
  )
}
