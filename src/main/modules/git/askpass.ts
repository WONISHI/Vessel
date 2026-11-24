import { AsyncLocalStorage } from "node:async_hooks"
import { randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const environment = new AsyncLocalStorage<NodeJS.ProcessEnv>()
export type CredentialHandler = (operation: "get" | "store" | "erase", input: string) => Promise<string>
export const gitAuthenticationEnvironment = () => environment.getStore() ?? {}

/** A private per-operation askpass bridge. Credentials never enter argv or files. */
export async function withGitAskpass<T>(prompt: (value: string) => Promise<string | null>, action: () => Promise<T>, credentials?: CredentialHandler): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "vessel-askpass-"))
  const token = randomBytes(32).toString("hex")
  const server = createServer((request, response) => {
    if (request.method !== "POST" || request.headers.authorization !== `Bearer ${token}`) { response.writeHead(403).end(); return }
    let body = ""
    request.on("data", chunk => { body += chunk; if (body.length > 32768) request.destroy() })
    request.on("end", () => {
      void (async () => {
        try {
          const data = JSON.parse(body)
          if (credentials && ["get", "store", "erase"].includes(data.operation) && typeof data.input === "string" && data.input.length <= 7000) {
            const answer = await credentials(data.operation, data.input)
            response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end(answer)
            return
          }
          const value = data.prompt
          if (typeof value !== "string" || value.length > 4096) throw new Error("Invalid prompt")
          const answer = await prompt(value)
          response.writeHead(answer === null ? 401 : 200, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end(answer ?? "")
        } catch { response.writeHead(401).end() }
      })()
    })
  })
  try {
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("无法启动 Git 认证")
    const script = join(directory, "askpass.cjs")
    await writeFile(script, `const http = require('node:http');
function send(data) {
 const request = http.request({hostname:'127.0.0.1',port:process.env.VESSEL_ASKPASS_PORT,method:'POST',headers:{Authorization:'Bearer '+process.env.VESSEL_ASKPASS_TOKEN}}, response => {
  if(response.statusCode!==200){response.resume();process.exitCode=1;return}
  response.pipe(process.stdout);
 });
 request.on('error',()=>{process.exitCode=1});
 request.end(JSON.stringify(data));
}
if(process.argv[2]==='credential') {
 let input=''; process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{input+=chunk;if(input.length>7000)process.exit(1)});
 process.stdin.on('end',()=>send({operation:process.argv[3],input}));
} else send({prompt:process.argv[2]});
`, { mode: 0o600 })
    const launcher = join(directory, process.platform === "win32" ? "askpass.cmd" : "askpass.sh")
    const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`
    await writeFile(launcher, process.platform === "win32"
      ? `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${process.execPath}" "${script}" %*\r\n`
      : `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${quote(process.execPath)} ${quote(script)} "$@"\n`, { mode: 0o700 })
    // Append a helper for this child process only; never modify repository/global config.
    const helperEnvironment: NodeJS.ProcessEnv = {}
    if (credentials) {
      const count = Number(process.env.GIT_CONFIG_COUNT || 0)
      helperEnvironment.GIT_CONFIG_COUNT = String(count + 1)
      helperEnvironment[`GIT_CONFIG_KEY_${count}`] = "credential.helper"
      helperEnvironment[`GIT_CONFIG_VALUE_${count}`] = `!${process.platform === "win32" ? `ELECTRON_RUN_AS_NODE=1 "${process.execPath.replace(/\\/g, "/")}" "${script.replace(/\\/g, "/")}"` : `ELECTRON_RUN_AS_NODE=1 ${quote(process.execPath)} ${quote(script)}`} credential`
    }
    return await environment.run({ ...helperEnvironment, GIT_ASKPASS: launcher, GIT_TERMINAL_PROMPT: "0", VESSEL_ASKPASS_PORT: String(address.port), VESSEL_ASKPASS_TOKEN: token }, action)
  } finally {
    server.closeAllConnections()
    server.close()
    await rm(directory, { recursive: true, force: true })
  }
}
