# @vessel/sync

独立于 Electron 的 Node.js 文件同步包，支持双向同步、单向上传/下载、批量远端比较、并发传输、S3 分片上传、冲突策略、同步预览、删除保护、进度和取消。无第三方运行时依赖；支持 Node.js 20.20+、CommonJS、ESM 和 TypeScript。

## 使用

```ts
import { collectFiles, createS3Storage, syncFiles } from "@vessel/sync"

const controller = new AbortController()
const root = "/home/user/notes"
const storage = createS3Storage(
  {
    endpoint: "https://s3.example.com",
    bucket: "notes",
    region: "us-east-1",
    accessKey: process.env.S3_ACCESS_KEY!
  },
  process.env.S3_SECRET_KEY!
)

const options = {
  files: await collectFiles({ root, signal: controller.signal }),
  root,
  storage,
  stateDirectory: "/home/user/.cache/notes-sync", // 位于工作区之外
  prefix: "notes",
  direction: "bidirectional" as const,
  concurrency: 8,
  conflictStrategy: "keep-both" as const,
  propagateDeletes: false,
  signal: controller.signal,
  onProgress: ({ phase, completed, total, bytes }) => {
    console.log(phase, `${completed}/${total}`, bytes)
  }
}

// 预览和执行各自重新读取状态；旧计划不会被盲目执行。
const preview = await syncFiles({ ...options, dryRun: true })
console.table(preview.plan)
const result = await syncFiles(options)
console.log(result.changed, result.downloaded, result.conflicts, result.durationMs)
// controller.abort() 可取消扫描、哈希、网络请求和重试等待。
```

## 同步规则

先合并本地文件、远端列表和上次同步记录，生成计划，再执行文件操作。

| 情况                             | 双向模式处理                                |
| -------------------------------- | ------------------------------------------- |
| 仅本地新增或修改                 | 上传                                        |
| 仅远端新增或修改                 | 下载                                        |
| 双方内容一致                     | 更新本地记录，不传输                        |
| 双方同时修改，或首次同步内容不同 | 按冲突策略处理                              |
| 一端删除，另一端未修改           | 启用删除传播时删除另一端；否则保留/恢复文件 |
| 一端删除，另一端修改             | 保留修改，不传播删除                        |
| 双方不存在                       | 清理历史记录                                |

冲突策略支持 `keep-both`（默认）、`keep-newer`、`keep-larger`、`error`。双向 `keep-both` 保留远端原文件，把本地内容保存为同目录 `name.conflict-local-<sha256>.ext` 并同步到远端，再将远端原文件下载到本地。单向上传的冲突副本存放在远端 `.vessel/conflicts/`；单向下载的副本只保存在本地。相同副本不会重复生成。

`keep-newer` 使用对象时间：S3 写入本地 mtime 元数据，必要的 HEAD 会读取它；列表本身提供服务端 LastModified。跨设备系统时钟需可靠。`keep-larger` 相同大小时选择远端。单向模式不会为冲突策略执行反方向传输。

下载先写随机临时文件，校验内容、长度、远端 ETag，再检查本地状态，最后提交；新增文件使用原子 create-only，已有文件使用 rename。下载目录不能越出工作区或穿过符号链接。仍需调用方避免在提交的最后一个文件系统操作间隙并发改写同一路径（本地文件系统没有通用的 compare-and-swap）。

## 同步排除规则与诊断日志

```ts
import { createSyncExcludeFilter, collectFiles, syncFiles } from "@vessel/sync"

// 两种写法等价：{file:a,b,c},{folder:d}
const excludePath = createSyncExcludeFilter("{file:a,b,c;folder:d}")
const files = await collectFiles({ root, excludePath })
await syncFiles({ ...options, files, excludePath, onLog: event => console.log(event) })
```

文件规则只匹配文件，文件夹规则排除整个目录及其内容。单个名称在任意层级匹配；含 `/` 的路径相对工作区根目录匹配；支持 `*` 和 `?`，例如 `{file:*.log;folder:images,img}`。文件名需包含扩展名。`parseSyncExcludeRules` 可单独校验语法，错误规则会抛出异常。

扫描与同步须使用同一 `excludePath`，它同时过滤本地、远端和历史记录，排除项不会触发删除传播。扫描可通过 `onExcluded(path, kind)` 观察跳过的条目。`onLog` 接收开始、阶段、实际操作、完成和错误事件；回调异常不会中止同步。包不自动持久化日志，调用方负责保存与脱敏。

Vessel 设置中的“同步排除规则”和“同步诊断日志”按工作区保存。启用日志并保存后开始记录，日志检查面板可查看、刷新和清空；本地最多保存 1000 条，界面显示最近 200 条。关闭日志停止新增记录，已有记录仍可查看。

## 性能

- 使用完整分页 `ListObjectsV2`，每页最多 1000 对象。已有 SHA-256 基线且列表 ETag/大小未变化时直接比较，不逐文件 HEAD。
- 首次接入已有对象时，正向匹配单段 ETag 与本地 MD5，可在没有 Vessel SHA 元数据时建立基线。MD5 与 SHA 在同一次本地读取中计算并缓存；只使用匹配结果，不把不匹配/未知 ETag 自动判成不同内容。
- 无法通过 ETag 或 SHA 元数据判断的内容，下载验证一次；相同则记录基线，不制造冲突，不同则复用已验证的内容执行计划。
- 远端版本变化或无法直接比较时，补充 HEAD。列表缺失的对象直接采用条件创建。
- 单向上传遇到列表权限不足/不支持时回退逐文件 HEAD；双向同步必须取得完整列表，权限错误或格式错误不会被当成空远端。
- 默认 8 个文件并发；按 size、mtime、ctime、inode、device 缓存哈希。`verification: "content"` 强制重算，并绕过 ETag-MD5 快速接入；MD5 比较也可由 S3 选项 `compareSinglePartEtags: false` 关闭。
- 无变化项不重写索引；状态按批次原子保存。失败前等待在途任务结束，保存成功记录。
- 32 MiB 起使用 multipart；默认 8 MiB 分片、同一适配器总计 4 个分片并发。每块重试，完成请求也带条件写入，失败/取消后尝试清理分片。
- 传输进度包含当前文件、进行中字节数、累计时间；哈希和远端列表阶段单独显示。

可复现模拟基准：256 个 16 KiB 文件，每次远端请求延迟 10 ms。2026-10-14 本机结果：

| 场景       | 逐文件 HEAD / 4 并发 | 批量列表 / 8 并发 | 请求数变化 |
| ---------- | -------------------- | ----------------- | ---------- |
| 首次上传   | 1553 ms              | 411 ms            | 512 → 257  |
| 无变化检查 | 749 ms               | 16 ms             | 256 → 1    |

这用于验证请求减少，不代表真实 S3 带宽。首次同步已有且无本地版本记录的对象仍需补查；首次上传约 2 GB 文件仍受上传带宽约束。

## API 与配置

`syncFiles(options)`：

| 参数                                 | 默认                      | 说明                                                         |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------ |
| `files`, `storage`, `stateDirectory` | 必填                      | 本地文件列表、存储适配器、本地索引目录；不同工作区独立索引   |
| `root`                               | 无                        | 双向/下载必填；文件列表中 `path` 必须对应工作区内的 `source` |
| `prefix`                             | 空                        | 远端相对前缀                                                 |
| `direction`                          | `push`                    | `push`、`pull`、`bidirectional`；保持旧包调用的兼容性        |
| `concurrency`                        | `8`                       | 1–32 个文件                                                  |
| `conflictStrategy`                   | `keep-both`               | `keep-newer`、`keep-larger`、`error`                         |
| `propagateDeletes`                   | `false`                   | 本地清单必须完整，或通过 `paths` 明确限定范围                |
| `deleteThresholdPercent`             | `20`                      | 删除比例超过阈值时整体中止；100 表示不限制比例               |
| `maxFileSize`                        | `0`                       | 大小限制，字节；0 不限制；适配器自身上限仍生效               |
| `exclude`                            | 无                        | 各路径段过滤；对本地、远端和历史均生效                       |
| `paths`                              | 全工作区                  | 限定本次操作范围，适用于选中文件同步                         |
| `verification`                       | `stat`                    | `content` 每次重新哈希                                       |
| `checkpointEvery`                    | `32`                      | 成功状态批次大小，结束/失败均保存                            |
| `signal`, `onProgress`               | 无                        | 取消、阶段和文件进度；回调不要抛错或执行耗时工作             |
| `dryRun`                             | `false`                   | 只生成计划，不传输、不删除、不提交索引                       |
| `indexName`                          | `backup-files-index.json` | 单个文件名                                                   |

返回：`changed`（上传数）、`size`（上传字节）、`downloaded`、`downloadSize`、`deleted`、`conflicts`、`skipped`、`checked`（HEAD 数）、`hashed`、`cached`、`verified`（缺少校验元数据而进行内容验证的文件数）、`durationMs`、`time`。预览还返回 `plan` 和 `dryRun`。

`collectFiles({ root, selected?, exclude?, concurrency?, signal? })` 批量扫描目录，默认跳过符号链接及 `.vessel`、`.git`、`.obsidian`、`.gut`、依赖/构建/常见敏感文件。传入自定义 `exclude` 时，可组合 `excludedBackupName`。

`createS3Storage(config, secret, options?)` 支持 AWS SigV4、COS 桶地址、`fetch` 注入和取消。请求选项：`retries` 默认 2；`timeoutMs` 可覆盖单次超时；`multipartThreshold` 默认 32 MiB；`partSize` 默认 8 MiB（5–64 MiB）；`partConcurrency` 默认 4（1–8）。单对象当前限制 5 GiB。默认普通请求 60 秒、上传/下载 30 分钟。408、429、500、502、503、504、网络/超时错误指数退避；认证和真实条件冲突不会无条件重试覆盖。

也导出底层 `signedS3Request`、`requestS3`、`headS3File`、`uploadS3File`、`listS3Files`、`downloadS3File`、`removeS3File`。

`SyncError` 提供稳定 `code`、`details.path`、HTTP `details.status`、执行部分结果 `details.result` 和 `cause`。常见代码：`REMOTE_CONFLICT`、`FILE_CHANGED`、`DELETE_PROTECTION`、`STATE_BUSY`、`INVALID_STATE`、`UNSUPPORTED`。

## 存储扩展

`StorageAdapter` 的 `id` 是稳定目标标识，不要包含秘密；`head` 返回 `{ digest, etag, size?, modifiedMs? }`，不存在返回 undefined，访问错误必须抛出；`upload` 必须 create-only 或以给定 ETag 条件替换，并应返回上传后 ETag；可选 `list` 提供完整分页列表、`download` 条件下载、`remove` 条件删除。没有列表/下载能力的适配器可继续支持单向上传。类型定义见 `src/types.ts`。

目前内置 S3 兼容存储；没有集成 Dropbox、OneDrive、WebDAV OAuth 或端到端加密，也没有复制 remotely-save 的商业代码或做格式兼容声明。

## 删除与恢复

删除传播默认关闭。启用后只删除有共享基线、且另一端未修改的文件；一端新增或扫描排除不会触发另一端删除。批量删除保护在任何传输前检查。

本地删除使用 rename 移入工作区 `.vessel/trash/<id>/<原路径>`，目录自动排除同步；可手动取回。远端删除使用 If-Match；要求服务端正确实现条件写入。远端对象版本管理/回收由存储服务设置控制。

## 状态与开发

索引按临时文件 + rename 更新，`.lock` 防止多进程写入。异常终止留下锁时，仅在确认锁所属进程已经退出后自动恢复；不会抢占活跃进程。损坏或无法确认所属进程的锁需要手动检查。旧 Vessel 索引自动迁移，已上传一致内容不会重传。进程被杀可能丢失未保存批次的本地记录，重试会比较远端。

```sh
npm run build --workspace=@vessel/sync
npm run test --workspace=@vessel/sync
npm run benchmark --workspace=@vessel/sync
npm pack --workspace=@vessel/sync
```

工作区从源码编入 Electron；npm 产物包含 JS、类型声明、source map、源码和此文档。当前版本 0.2.1，尚未发布 npm，许可证为 UNLICENSED。

## 参考

设计参考 remotely-save 的 [S3 列表与分片实现](https://github.com/remotely-save/remotely-save/blob/master/src/fsS3.ts)、[同步计划和执行流程](https://github.com/remotely-save/remotely-save/blob/master/pro/src/sync.ts)、[配置和方向定义](https://github.com/remotely-save/remotely-save/blob/master/src/baseTypes.ts)。这里是独立实现，不依赖 Obsidian 或 remotely-save。

## 0.2.1：已有仓库接入修复

修复“远端没有 Vessel SHA-256 元数据就被当作冲突”的错误。2026-10-15 针对已存在且内容相同的远端仓库进行回归：128 个 16 KiB 文件、每个请求模拟 10 ms 延迟，用 0.2.0 原包与修复版本对比。

| 项目             | 0.2.0     | 0.2.1   |
| ---------------- | --------- | ------- |
| 列表请求         | 1         | 1       |
| HEAD / GET / PUT | 各 128 次 | 各 0 次 |
| 错误冲突副本     | 128       | 0       |
| 网络传输内容     | 4 MiB     | 0       |
| 本机模拟耗时     | 707 ms    | 23 ms   |

此测试覆盖没有 SHA 元数据、仅有单段内容 ETag 的首次接入场景；不是实际 S3 网络测速。只有真实变化项进入传输进度，无变化文件的基线批量落盘。
