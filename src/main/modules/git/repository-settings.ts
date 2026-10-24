import { runGit } from "@main/modules/git/git-service"
import type { GitRepositorySettings } from "@vessel/type/git"
import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"

/** Read one Git configuration value without confusing missing values with command errors. */
async function config(cwd: string, key: string, scope?: "local" | "global") {
  const result = await runGit(["config", ...(scope ? [`--${scope}`] : []), "--get", key], cwd)
  if (result.exitCode !== 0 && result.exitCode !== 1) throw new Error(result.stderr || "无法读取 Git 配置")
  return result.exitCode === 0 ? result.stdout.trim() : null
}

/** Read a configured text file; an absent optional file is empty. */
async function optionalText(path: string) {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw error
  }
}

/** Read current repository preferences, preserving inherited identity and template values. */
export async function getRepositorySettings(cwd: string): Promise<GitRepositorySettings> {
  const names = await runGit(["remote"], cwd)
  if (names.exitCode !== 0) throw new Error(names.stderr || "无法读取仓库")
  const remotes = await Promise.all(
    names.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(async (name) => ({ name, url: (await config(cwd, `remote.${name}.url`)) ?? "" }))
  )
  const [localTemplate, templatePath, userName, userEmail, globalName, globalEmail, signCommits, signingKey] = await Promise.all([
    config(cwd, "commit.template", "local"),
    config(cwd, "commit.template"),
    config(cwd, "user.name", "local"),
    config(cwd, "user.email", "local"),
    config(cwd, "user.name", "global"),
    config(cwd, "user.email", "global"),
    config(cwd, "commit.gpgsign"),
    config(cwd, "user.signingkey")
  ])
  const expand = (path: string) => (path.startsWith("~/") ? join(process.env.HOME || "", path.slice(2)) : isAbsolute(path) ? path : resolve(cwd, path))
  return {
    remotes,
    templateMode: localTemplate === null ? "default" : localTemplate === "" ? "none" : "custom",
    template: templatePath ? await optionalText(expand(templatePath)) : "",
    signCommits: /^(true|yes|on|1)$/i.test(signCommits ?? "false"),
    signingKey: signingKey ?? "",
    useGlobalIdentity: userName === null && userEmail === null,
    userName: userName ?? globalName ?? "",
    userEmail: userEmail ?? globalEmail ?? "",
    globalName: globalName ?? "",
    globalEmail: globalEmail ?? "",
    ignore: await optionalText(join(cwd, ".gitignore"))
  }
}

/** Save repository-local preferences without changing the user's global Git configuration. */
export async function saveRepositorySettings(cwd: string, settings: GitRepositorySettings): Promise<void> {
  const valid = await runGit(["rev-parse", "--show-toplevel"], cwd)
  if (valid.exitCode !== 0) throw new Error("请选择有效的 Git 仓库")
  const seen = new Set<string>()
  for (const remote of settings.remotes) {
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(remote.name) || !remote.url.trim() || /[\r\n\0]/.test(remote.url) || seen.has(remote.name)) throw new Error("远程仓库名称重复或地址无效")
    seen.add(remote.name)
  }
  if (!["none", "default", "custom"].includes(settings.templateMode)) throw new Error("提交模板模式无效")
  if (!settings.useGlobalIdentity && (!settings.userName.trim() || !settings.userEmail.trim())) throw new Error("请填写提交者姓名和电子邮件")
  const execute = async (args: string[], missingAllowed = false) => {
    const result = await runGit(args, cwd)
    if (result.exitCode !== 0 && !(missingAllowed && result.exitCode === 5)) throw new Error(result.stderr || "保存仓库设置失败")
  }
  const set = (key: string, value: string | null) => (value === null ? execute(["config", "--local", "--unset-all", key], true) : execute(["config", "--local", "--replace-all", key, value]))
  const old = await getRepositorySettings(cwd)
  for (const remote of old.remotes) if (!seen.has(remote.name)) await execute(["remote", "remove", remote.name])
  for (const remote of settings.remotes) {
    const previous = old.remotes.find((item) => item.name === remote.name)
    if (!previous) await execute(["remote", "add", remote.name, remote.url.trim()])
    else if (previous.url !== remote.url.trim()) await execute(["remote", "set-url", remote.name, remote.url.trim()])
  }
  await set("user.name", settings.useGlobalIdentity ? null : settings.userName.trim())
  await set("user.email", settings.useGlobalIdentity ? null : settings.userEmail.trim())
  await set("commit.gpgsign", String(settings.signCommits))
  await set("user.signingkey", settings.signingKey.trim() || null)
  if (settings.templateMode === "custom") {
    const result = await runGit(["rev-parse", "--git-path", "vessel-commit-template"], cwd)
    if (result.exitCode !== 0) throw new Error(result.stderr)
    const path = resolve(cwd, result.stdout.trim())
    await writeFile(path, settings.template, { mode: 0o600 })
    await set("commit.template", path)
  } else await set("commit.template", settings.templateMode === "none" ? "" : null)
  if (settings.ignore !== old.ignore) await writeFile(join(cwd, ".gitignore"), settings.ignore, "utf8")
}
