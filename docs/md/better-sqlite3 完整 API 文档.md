# better-sqlite3 完整 API 文档

> better-sqlite3 是 Node.js 的同步 SQLite 库，以高性能和简洁 API 著称。
> 官方仓库：https://github.com/WiseLibs/better-sqlite3

---

## 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [一、Database 类](#一database-类)
  - [1.1 new Database()](#11-new-databasepath-options)
  - [1.2 db.prepare()](#12-dbpreparesql)
  - [1.3 db.exec()](#13-dbexecsql)
  - [1.4 db.pragma()](#14-dbpragmaname-options)
  - [1.5 db.transaction()](#15-dbtransactionfn)
  - [1.6 db.function()](#16-dbfunctionname-options-fn)
  - [1.7 db.aggregate()](#17-dbaggregatename-options)
  - [1.8 db.backup()](#18-dbbackupdestination-options)
  - [1.9 db.serialize() / db.deserialize()](#19-dbserialize--dbdeserializebuffer)
  - [1.10 db.loadExtension()](#110-dbloadextensionpath-entrypoint)
  - [1.11 db.close()](#111-dbclose)
  - [1.12 db.on() 事件](#112-dbonevent-listener)
  - [1.13 Database 属性](#113-database-属性)
- [二、Statement 类](#二statement-类)
  - [2.1 stmt.run()](#21-stmtrunparams)
  - [2.2 stmt.get()](#22-stmtgetparams)
  - [2.3 stmt.all()](#23-stmtallparams)
  - [2.4 stmt.iterate()](#24-stmtiterateparams)
  - [2.5 stmt.raw()](#25-stmtraw)
  - [2.6 stmt.pluck()](#26-stmtpluck)
  - [2.7 stmt.expand()](#27-stmtexand)
  - [2.8 stmt.bind()](#28-stmtbindparams)
  - [2.9 stmt.columns()](#29-stmtcolumns)
  - [2.10 Statement 属性](#210-statement-属性)
- [三、Transaction 类](#三transaction-类)
  - [3.1 事务执行](#31-事务执行)
  - [3.2 事务类型](#32-事务类型)
  - [3.3 嵌套事务](#33-嵌套事务)
- [四、参数绑定](#四参数绑定)
  - [4.1 位置参数](#41-位置参数)
  - [4.2 命名参数](#42-命名参数)
  - [4.3 数组参数](#43-数组参数)
- [五、数据类型映射](#五数据类型映射)
- [六、错误处理](#六错误处理)
- [七、性能最佳实践](#七性能最佳实践)
- [八、常见问题](#八常见问题)

---

## 安装

```bash
# npm
npm install better-sqlite3

# pnpm
pnpm add better-sqlite3

# yarn
yarn add better-sqlite3
```

> **Electron 项目注意**：需要用 `electron-rebuild` 重新编译原生模块。
>
> ```bash
> npx electron-rebuild
> # 或在 package.json 的 postinstall 中配置
> ```

---

## 快速开始

```js
const Database = require("better-sqlite3")

// 打开数据库（不存在则创建）
const db = new Database("mydb.db")

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    age INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`)

// 插入（预编译语句）
const insert = db.prepare("INSERT INTO users (name, email, age) VALUES (?, ?, ?)")
const info = insert.run("Alice", "alice@example.com", 25)
console.log("插入ID:", info.lastInsertRowid) // 1

// 查询单行
const user = db.prepare("SELECT * FROM users WHERE id = ?").get(1)
console.log(user) // { id: 1, name: 'Alice', email: 'alice@example.com', age: 25, created_at: '...' }

// 查询多行
const users = db.prepare("SELECT * FROM users").all()

// 事务
const insertMany = db.transaction((users) => {
  for (const u of users) insert.run(u.name, u.email, u.age)
})
insertMany([
  { name: "Bob", email: "bob@example.com", age: 30 },
  { name: "Charlie", email: "charlie@example.com", age: 35 }
])

db.close()
```

---

## 一、Database 类

### 1.1 new Database(path, options?)

创建或打开一个 SQLite 数据库。

**参数：**

| 参数      | 类型     | 必填 | 默认值 | 说明                                                                       |
| --------- | -------- | ---- | ------ | -------------------------------------------------------------------------- |
| `path`    | `string` | 是   | -      | 数据库文件路径。特殊值：`:memory:` 表示内存数据库，`''` 表示临时磁盘数据库 |
| `options` | `object` | 否   | -      | 配置选项                                                                   |

**options 取值：**

| 选项            | 类型       | 默认值  | 说明                                |
| --------------- | ---------- | ------- | ----------------------------------- |
| `readonly`      | `boolean`  | `false` | 以只读模式打开                      |
| `fileMustExist` | `boolean`  | `false` | 数据库文件必须已存在，否则报错      |
| `timeout`       | `number`   | `5000`  | 数据库锁等待超时时间（毫秒）        |
| `verbose`       | `function` | -       | 日志函数，会接收每条执行的 SQL 语句 |
| `nativeBinding` | `string`   | -       | 指定原生绑定模块路径                |

**示例：**

```js
// 基础用法
const db = new Database("app.db")

// 只读模式
const db = new Database("app.db", { readonly: true })

// 文件必须存在
const db = new Database("app.db", { fileMustExist: true })

// 自定义超时
const db = new Database("app.db", { timeout: 10000 })

// 打印所有 SQL（调试用）
const db = new Database("app.db", { verbose: console.log })

// 内存数据库（数据不持久化）
const db = new Database(":memory:")

// 临时数据库（程序退出后删除）
const db = new Database("")
```

---

### 1.2 db.prepare(sql)

预编译一条 SQL 语句，返回 `Statement` 对象。

**参数：**

| 参数  | 类型     | 必填 | 说明                                  |
| ----- | -------- | ---- | ------------------------------------- |
| `sql` | `string` | 是   | 要预编译的 SQL 语句，只能包含一条语句 |

**返回值：** `Statement` 对象

**示例：**

```js
const stmt = db.prepare("SELECT * FROM users WHERE id = ?")

// 预编译后可多次执行，性能更好
stmt.get(1)
stmt.get(2)
stmt.get(3)
```

> **注意**：`prepare()` 只能编译一条 SQL 语句。多条语句请用 `db.exec()`。

---

### 1.3 db.exec(sql)

执行一条或多条 SQL 语句，**不返回任何结果**。

**参数：**

| 参数  | 类型     | 必填 | 说明                                         |
| ----- | -------- | ---- | -------------------------------------------- |
| `sql` | `string` | 是   | 要执行的 SQL，可以包含多条语句（用分号分隔） |

**返回值：** `Database` 对象本身（支持链式调用）

**示例：**

```js
// 执行多条 SQL
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT);
  INSERT INTO users (name) VALUES ('Alice');
  INSERT INTO users (name) VALUES ('Bob');
`)

// 链式调用
db.exec("CREATE TABLE foo (bar)").exec("INSERT INTO foo VALUES (1)")
```

> **适用场景**：建表、初始化数据、批量 DDL 操作。不需要返回值的操作都可以用 `exec()`。

---

### 1.4 db.pragma(name, options?)

执行 SQLite 的 `PRAGMA` 命令，用于配置数据库行为或查询数据库状态。

**参数：**

| 参数      | 类型     | 必填 | 说明                                                           |
| --------- | -------- | ---- | -------------------------------------------------------------- |
| `name`    | `string` | 是   | PRAGMA 名称和值，如 `'journal_mode = WAL'` 或 `'journal_mode'` |
| `options` | `object` | 否   | 配置选项                                                       |

**options 取值：**

| 选项     | 类型      | 默认值  | 说明                                             |
| -------- | --------- | ------- | ------------------------------------------------ |
| `simple` | `boolean` | `false` | 简单模式：设置时不返回结果，查询时只返回第一个值 |

**常用 PRAGMA 取值：**

| PRAGMA                  | 说明           | 常用值                                          |
| ----------------------- | -------------- | ----------------------------------------------- |
| `journal_mode`          | 日志模式       | `DELETE` / `WAL` / `MEMORY` / `OFF`             |
| `synchronous`           | 同步级别       | `0`(OFF) / `1`(NORMAL) / `2`(FULL) / `3`(EXTRA) |
| `cache_size`            | 缓存大小（KB） | 如 `-20000`(20MB)，负数表示 KB                  |
| `foreign_keys`          | 外键约束       | `0`(关闭) / `1`(开启)                           |
| `auto_vacuum`           | 自动清理       | `0`(NONE) / `1`(FULL) / `2`(INCREMENTAL)        |
| `page_size`             | 页大小         | 如 `4096`                                       |
| `busy_timeout`          | 锁等待超时(ms) | 如 `5000`                                       |
| `wal_autocheckpoint`    | WAL 自动检查点 | 如 `1000`(页)                                   |
| `mmap_size`             | 内存映射大小   | 如 `268435456`(256MB)                           |
| `table_info(tablename)` | 表结构信息     | -                                               |
| `index_list(tablename)` | 索引列表       | -                                               |
| `database_list`         | 数据库列表     | -                                               |
| `integrity_check`       | 完整性检查     | -                                               |
| `user_version`          | 用户版本号     | 任意整数                                        |
| `application_id`        | 应用ID         | 任意整数                                        |

**示例：**

```js
// 设置 PRAGMA（返回设置后的值）
db.pragma("journal_mode = WAL") // [{ journal_mode: 'wal' }]
db.pragma("foreign_keys = ON") // [{ foreign_keys: 1 }]
db.pragma("synchronous = NORMAL") // [{ synchronous: 1 }]
db.pragma("cache_size = -20000") // 20MB 缓存

// 查询 PRAGMA
db.pragma("journal_mode") // [{ journal_mode: 'wal' }]
db.pragma("table_info(users)") // 表结构信息数组

// simple 模式
db.pragma("journal_mode = WAL", { simple: true }) // undefined（设置时不返回）
db.pragma("journal_mode", { simple: true }) // 'wal'（查询时返回第一个值）
```

---

### 1.5 db.transaction(fn)

创建一个事务函数，调用该函数时会在事务中执行。

**参数：**

| 参数 | 类型       | 必填 | 说明                 |
| ---- | ---------- | ---- | -------------------- |
| `fn` | `function` | 是   | 要在事务中执行的函数 |

**返回值：** 事务函数（调用时执行事务）

**示例：**

```js
const insert = db.prepare("INSERT INTO users (name) VALUES (?)")

// 创建事务
const insertUsers = db.transaction((names) => {
  for (const name of names) {
    insert.run(name)
  }
  return names.length
})

// 执行事务（原子性：全部成功或全部回滚）
const count = insertUsers(["Alice", "Bob", "Charlie"])
console.log(`插入了 ${count} 条记录`)

// 事务中抛出错误会自动回滚
const badTransaction = db.transaction(() => {
  insert.run("Dave")
  throw new Error("出错了，会回滚")
})
try {
  badTransaction()
} catch (e) {
  console.log("事务已回滚")
}
```

---

### 1.6 db.function(name, options?, fn)

注册一个自定义的 SQLite 标量函数，可在 SQL 中调用。

**参数：**

| 参数      | 类型       | 必填 | 说明                            |
| --------- | ---------- | ---- | ------------------------------- |
| `name`    | `string`   | 是   | 函数名（在 SQL 中使用）         |
| `options` | `object`   | 否   | 配置选项                        |
| `fn`      | `function` | 是   | 函数实现，参数为 SQL 传入的参数 |

**options 取值：**

| 选项            | 类型      | 默认值  | 说明                                                               |
| --------------- | --------- | ------- | ------------------------------------------------------------------ |
| `deterministic` | `boolean` | `false` | 是否为确定性函数（相同输入总是返回相同输出）。设为 true 可优化查询 |
| `safeIntegers`  | `boolean` | `false` | 是否返回安全整数（BigInt）                                         |
| `varargs`       | `boolean` | `false` | 是否为可变参数函数                                                 |

**返回值：** `Database` 对象本身（支持链式调用）

**示例：**

```js
// 基础函数
db.function("add", (a, b) => a + b)
db.prepare("SELECT add(1, 2) AS result").get() // { result: 3 }

// 字符串处理函数
db.function("reverse", (str) => str.split("").reverse().join(""))
db.prepare("SELECT reverse('hello') AS result").get() // { result: 'olleh' }

// 确定性函数（可被查询优化器缓存）
db.function("hash", { deterministic: true }, (input) => {
  return require("crypto").createHash("md5").update(input).digest("hex")
})

// 可变参数函数
db.function("concat", { varargs: true }, (...args) => args.join(""))
db.prepare("SELECT concat('a', 'b', 'c') AS result").get() // { result: 'abc' }

// 链式注册多个函数
db.function("upper", (s) => s.toUpperCase())
  .function("lower", (s) => s.toLowerCase())
  .function("length", (s) => s.length)
```

---

### 1.7 db.aggregate(name, options)

注册一个自定义的 SQLite 聚合函数（类似 `SUM`、`COUNT`、`AVG`）。

**参数：**

| 参数      | 类型     | 必填 | 说明         |
| --------- | -------- | ---- | ------------ |
| `name`    | `string` | 是   | 聚合函数名   |
| `options` | `object` | 是   | 聚合函数配置 |

**options 取值：**

| 选项            | 类型               | 必填 | 说明                                                           |
| --------------- | ------------------ | ---- | -------------------------------------------------------------- |
| `start`         | `any` / `function` | 否   | 初始值，或返回初始值的函数。默认为 `undefined`                 |
| `step`          | `function`         | 是   | 每一行调用一次，参数为 `(accumulator, ...rowValues)`           |
| `result`        | `function`         | 否   | 聚合结束时调用，参数为 `accumulator`，返回最终结果             |
| `inverse`       | `function`         | 否   | 反向操作（用于窗口函数），参数为 `(accumulator, ...rowValues)` |
| `deterministic` | `boolean`          | 否   | 是否为确定性函数                                               |
| `safeIntegers`  | `boolean`          | 否   | 是否返回安全整数                                               |
| `varargs`       | `boolean`          | 否   | 是否为可变参数                                                 |

**返回值：** `Database` 对象本身

**示例：**

```js
// 求和聚合
db.aggregate("sum_squares", {
  start: 0,
  step: (total, value) => total + value * value,
  result: (total) => total
})
db.prepare("SELECT sum_squares(value) AS result FROM data").get()

// 字符串拼接聚合
db.aggregate("group_concat_custom", {
  start: "",
  step: (acc, value, separator = ",") => (acc ? acc + separator + value : value),
  result: (acc) => acc
})

// 平均值聚合（带计数）
db.aggregate("custom_avg", {
  start: () => ({ sum: 0, count: 0 }),
  step: (acc, value) => {
    acc.sum += value
    acc.count++
  },
  result: (acc) => (acc.count > 0 ? acc.sum / acc.count : null)
})

// 最大值聚合
db.aggregate("max_length", {
  start: 0,
  step: (max, str) => Math.max(max, str.length),
  result: (max) => max
})
```

---

### 1.8 db.backup(destination, options?)

异步备份数据库到另一个文件。

**参数：**

| 参数          | 类型     | 必填 | 说明         |
| ------------- | -------- | ---- | ------------ |
| `destination` | `string` | 是   | 目标文件路径 |
| `options`     | `object` | 否   | 配置选项     |

**options 取值：**

| 选项       | 类型       | 默认值 | 说明                                              |
| ---------- | ---------- | ------ | ------------------------------------------------- |
| `progress` | `function` | -      | 进度回调，参数为 `{ totalPages, remainingPages }` |

**返回值：** `Promise<void>`

**示例：**

```js
// 基础备份
await db.backup("backup.db")
console.log("备份完成")

// 带进度
await db.backup("backup.db", {
  progress: ({ totalPages, remainingPages }) => {
    const percent = Math.round((1 - remainingPages / totalPages) * 100)
    console.log(`备份进度: ${percent}%`)
  }
})

// 增量备份（先备份，后续可以继续写入源数据库）
// 注意：备份期间源数据库只读
```

> **注意**：备份是异步操作，返回 Promise。备份期间源数据库会被锁定为只读。

---

### 1.9 db.serialize() / db.deserialize(buffer)

将数据库序列化为 Buffer，或从 Buffer 反序列化为内存数据库。

**db.serialize()**

- **参数**：无
- **返回值**：`Buffer` - 数据库的完整二进制副本

**db.deserialize(buffer)**

- 这不是一个方法，而是通过 `new Database(buffer)` 实现
- **参数**：`buffer` - 数据库的 Buffer
- **返回值**：内存数据库实例

**示例：**

```js
// 序列化到 Buffer
const buffer = db.serialize()
console.log(buffer.length) // 数据库大小（字节）

// 保存到文件
require("fs").writeFileSync("backup.db", buffer)

// 从 Buffer 反序列化（内存数据库）
const buffer = require("fs").readFileSync("backup.db")
const db2 = new Database(buffer) // 内存中的数据库副本

// 深拷贝数据库
const copy = new Database(db.serialize())
```

> **注意**：`new Database(buffer)` 创建的是内存数据库，修改不会影响原 Buffer。

---

### 1.10 db.loadExtension(path, entryPoint?)

加载一个 SQLite 扩展（共享库）。

**参数：**

| 参数         | 类型     | 必填 | 说明                                      |
| ------------ | -------- | ---- | ----------------------------------------- |
| `path`       | `string` | 是   | 扩展文件路径（`.so` / `.dylib` / `.dll`） |
| `entryPoint` | `string` | 否   | 入口函数名，默认为自动推断                |

**返回值：** `Database` 对象本身

**示例：**

```js
// 加载扩展
db.loadExtension("./libsqlitefunctions.so")

// macOS
db.loadExtension("./libsqlitefunctions.dylib")

// Windows
db.loadExtension("./sqlitefunctions.dll")
```

> **安全提示**：只加载可信来源的扩展，扩展代码在进程内执行，可能有安全风险。

---

### 1.11 db.close()

关闭数据库连接。

**参数**：无
**返回值**：`undefined`

**示例：**

```js
db.close()

// 关闭后再操作会报错
try {
  db.prepare("SELECT 1").get()
} catch (e) {
  console.log("数据库已关闭")
}
```

> **注意**：关闭后所有预编译的 Statement 也会失效。程序退出时会自动关闭，但建议显式关闭。

---

### 1.12 db.on(event, listener)

监听数据库事件。

**支持的事件：**

| 事件     | 回调参数 | 说明                                 |
| -------- | -------- | ------------------------------------ |
| `change` | `info`   | 数据变更事件（INSERT/UPDATE/DELETE） |
| `close`  | 无       | 数据库关闭事件                       |

**change 事件 info 对象：**

| 字段       | 类型     | 说明                                           |
| ---------- | -------- | ---------------------------------------------- |
| `type`     | `string` | 变更类型：`'INSERT'` / `'UPDATE'` / `'DELETE'` |
| `database` | `string` | 数据库名（通常是 `'main'`）                    |
| `table`    | `string` | 表名                                           |
| `rowid`    | `number` | 受影响的行 ID                                  |

**示例：**

```js
// 监听数据变更
db.on("change", (info) => {
  console.log(`数据变更: ${info.type} on ${info.table} (rowid: ${info.rowid})`)
})

// 监听关闭
db.on("close", () => {
  console.log("数据库已关闭")
})

// 移除监听
const listener = (info) => console.log(info)
db.on("change", listener)
db.off("change", listener) // 移除
```

---

### 1.13 Database 属性

| 属性               | 类型      | 只读 | 说明             |
| ------------------ | --------- | ---- | ---------------- |
| `db.name`          | `string`  | 是   | 数据库文件名     |
| `db.open`          | `boolean` | 是   | 数据库是否打开   |
| `db.readonly`      | `boolean` | 是   | 是否为只读模式   |
| `db.memory`        | `boolean` | 是   | 是否为内存数据库 |
| `db.inTransaction` | `boolean` | 是   | 当前是否在事务中 |

**示例：**

```js
console.log(db.name) // 'app.db'
console.log(db.open) // true
console.log(db.readonly) // false
console.log(db.memory) // false
console.log(db.inTransaction) // false
```

---

## 二、Statement 类

Statement 对象由 `db.prepare(sql)` 创建，表示一条预编译的 SQL 语句。

### 2.1 stmt.run(...params)

执行语句（INSERT/UPDATE/DELETE/CREATE 等），不返回查询结果。

**参数：**

| 参数        | 类型  | 说明                               |
| ----------- | ----- | ---------------------------------- |
| `...params` | `any` | 绑定参数（位置参数或命名参数对象） |

**返回值：** `RunResult` 对象

**RunResult 字段：**

| 字段              | 类型                | 说明                                |
| ----------------- | ------------------- | ----------------------------------- |
| `changes`         | `number`            | 受影响的行数                        |
| `lastInsertRowid` | `number` / `bigint` | 最后插入的行 ID（仅 INSERT 有意义） |

**示例：**

```js
// INSERT
const insert = db.prepare("INSERT INTO users (name, age) VALUES (?, ?)")
const result = insert.run("Alice", 25)
console.log(result.changes) // 1
console.log(result.lastInsertRowid) // 1

// UPDATE
const update = db.prepare("UPDATE users SET age = ? WHERE name = ?")
const result = update.run(26, "Alice")
console.log(result.changes) // 1

// DELETE
const del = db.prepare("DELETE FROM users WHERE id = ?")
const result = del.run(1)
console.log(result.changes) // 1（删除的行数）

// 命名参数
db.prepare("INSERT INTO users (name, age) VALUES (@name, @age)").run({
  "@name": "Bob",
  "@age": 30
})
```

---

### 2.2 stmt.get(...params)

执行查询，返回**第一行**结果。

**参数：**

| 参数        | 类型  | 说明     |
| ----------- | ----- | -------- |
| `...params` | `any` | 绑定参数 |

**返回值：** 行对象（`object`）或 `undefined`（无结果时）

**示例：**

```js
const getUser = db.prepare("SELECT * FROM users WHERE id = ?")

const user = getUser.get(1)
console.log(user) // { id: 1, name: 'Alice', age: 25 } 或 undefined

// 带条件
const adult = db.prepare("SELECT * FROM users WHERE age >= ? ORDER BY age LIMIT 1").get(18)
```

> **注意**：只返回第一行。需要所有行用 `stmt.all()`，需要迭代用 `stmt.iterate()`。

---

### 2.3 stmt.all(...params)

执行查询，返回**所有行**的数组。

**参数：**

| 参数        | 类型  | 说明     |
| ----------- | ----- | -------- |
| `...params` | `any` | 绑定参数 |

**返回值：** 行对象数组（`object[]`），无结果时返回空数组 `[]`

**示例：**

```js
const getAllUsers = db.prepare("SELECT * FROM users ORDER BY id")

const users = getAllUsers.all()
console.log(users)
// [
//   { id: 1, name: 'Alice', age: 25 },
//   { id: 2, name: 'Bob', age: 30 },
// ]

// 带参数
const adults = db.prepare("SELECT * FROM users WHERE age >= ?").all(18)

// 空结果
const empty = db.prepare("SELECT * FROM users WHERE id = 999").all()
console.log(empty) // []
```

> **性能提示**：数据量大时（如 >10000 行），建议用 `stmt.iterate()` 避免一次性加载到内存。

---

### 2.4 stmt.iterate(...params)

执行查询，返回一个**迭代器**（Iterator），逐行返回结果。

**参数：**

| 参数        | 类型  | 说明     |
| ----------- | ----- | -------- |
| `...params` | `any` | 绑定参数 |

**返回值：** 迭代器（可用于 `for...of` 循环）

**示例：**

```js
const stmt = db.prepare("SELECT * FROM users")

// for...of 迭代
for (const user of stmt.iterate()) {
  console.log(user.id, user.name)
  // 处理大数据量时，内存占用低
}

// 手动迭代
const iterator = stmt.iterate()
let result
while (!(result = iterator.next()).done) {
  console.log(result.value)
}

// 提前终止（重要！必须调用 return 释放锁）
const iter = stmt.iterate()
for (const user of iter) {
  if (user.id > 10) {
    iter.return() // 提前终止，释放数据库锁
    break
  }
}
```

> **重要**：如果提前终止迭代，必须调用 `iterator.return()` 释放数据库锁，否则数据库会被锁定。

---

### 2.5 stmt.raw()

设置返回**原始数组**而非对象。链式调用，返回修改后的 Statement。

**参数**：无
**返回值：** `Statement` 对象（支持链式）

**示例：**

```js
// 默认返回对象
db.prepare("SELECT id, name FROM users").get(1)
// { id: 1, name: 'Alice' }

// raw() 返回数组
db.prepare("SELECT id, name FROM users").raw().get(1)
// [1, 'Alice']

// all() 也适用
db.prepare("SELECT id, name FROM users").raw().all()
// [[1, 'Alice'], [2, 'Bob']]

// 与 pluck() 组合
db.prepare("SELECT name FROM users").raw().pluck().all()
// ['Alice', 'Bob'] （注意：raw+pluck 返回一维数组）
```

> **性能提示**：`raw()` 比默认对象模式快约 2 倍，因为不需要构造对象。

---

### 2.6 stmt.pluck()

设置只返回**第一列**的值。链式调用。

**参数**：无
**返回值：** `Statement` 对象

**示例：**

```js
// 默认返回对象
db.prepare("SELECT name FROM users WHERE id = ?").get(1)
// { name: 'Alice' }

// pluck() 只返回第一列的值
db.prepare("SELECT name FROM users WHERE id = ?").pluck().get(1)
// 'Alice'

// all() 返回值数组
db.prepare("SELECT name FROM users").pluck().all()
// ['Alice', 'Bob', 'Charlie']

// 多列时只取第一列
db.prepare("SELECT id, name FROM users").pluck().all()
// [1, 2, 3]
```

---

### 2.7 stmt.expand()

设置展开列名为 `表名.列名` 的嵌套对象结构。链式调用。

**参数**：无
**返回值：** `Statement` 对象

**示例：**

```js
// 默认：扁平对象
db.prepare(
  `
  SELECT users.id, users.name, posts.title
  FROM users JOIN posts ON users.id = posts.user_id
`
).get()
// { id: 1, name: 'Alice', title: 'Hello' }

// expand(): 嵌套对象
db.prepare(
  `
  SELECT users.id, users.name, posts.title
  FROM users JOIN posts ON users.id = posts.user_id
`
)
  .expand()
  .get()
// {
//   users: { id: 1, name: 'Alice' },
//   posts: { title: 'Hello' }
// }
```

> **适用场景**：多表 JOIN 查询，避免列名冲突，结果结构更清晰。

---

### 2.8 stmt.bind(...params)

预绑定参数，返回一个新的已绑定参数的 Statement。

**参数：**

| 参数        | 类型  | 说明         |
| ----------- | ----- | ------------ |
| `...params` | `any` | 要绑定的参数 |

**返回值：** 新的 Statement 对象（已绑定参数）

**示例：**

```js
const stmt = db.prepare("SELECT * FROM users WHERE id = ? AND status = ?")

// 预绑定部分参数
const activeUser = stmt.bind(1, "active")

// 后续执行不需要再传参数
activeUser.get() // 等价于 stmt.get(1, 'active')
activeUser.all()

// 多次绑定不同值
const user1 = stmt.bind(1, "active")
const user2 = stmt.bind(2, "inactive")
```

> **注意**：`bind()` 返回新的 Statement，不修改原 Statement。原 Statement 仍可继续使用。

---

### 2.9 stmt.columns()

返回查询结果的**列信息**数组。

**参数**：无
**返回值：** 列信息数组

**列信息字段：**

| 字段       | 类型     | 说明                           |
| ---------- | -------- | ------------------------------ |
| `name`     | `string` | 列名（AS 别名）                |
| `column`   | `string` | 原始列名                       |
| `table`    | `string` | 表名                           |
| `database` | `string` | 数据库名                       |
| `type`     | `string` | 列类型（如 `INTEGER`、`TEXT`） |

**示例：**

```js
const stmt = db.prepare("SELECT id AS user_id, name FROM users")

const columns = stmt.columns()
console.log(columns)
// [
//   { name: 'user_id', column: 'id', table: 'users', database: 'main', type: 'INTEGER' },
//   { name: 'name', column: 'name', table: 'users', database: 'main', type: 'TEXT' },
// ]

// 表达式列
db.prepare("SELECT COUNT(*) AS count, MAX(age) AS max_age FROM users").columns()
// [
//   { name: 'count', column: null, table: null, database: null, type: null },
//   { name: 'max_age', column: null, table: null, database: null, type: null },
// ]
```

---

### 2.10 Statement 属性

| 属性            | 类型       | 只读 | 说明                              |
| --------------- | ---------- | ---- | --------------------------------- |
| `stmt.source`   | `string`   | 是   | SQL 源码                          |
| `stmt.database` | `Database` | 是   | 所属的 Database 实例              |
| `stmt.reader`   | `boolean`  | 是   | 是否为读取数据的语句（SELECT 等） |
| `stmt.readonly` | `boolean`  | 是   | 是否为只读语句（不修改数据）      |

**示例：**

```js
const stmt = db.prepare("SELECT * FROM users")

console.log(stmt.source) // 'SELECT * FROM users'
console.log(stmt.database) // [Database object]
console.log(stmt.reader) // true
console.log(stmt.readonly) // true

const insertStmt = db.prepare("INSERT INTO users (name) VALUES (?)")
console.log(insertStmt.reader) // false
console.log(insertStmt.readonly) // false
```

---

## 三、Transaction 类

### 3.1 事务执行

```js
const insert = db.prepare("INSERT INTO users (name) VALUES (?)")

// 创建事务函数
const transaction = db.transaction((names) => {
  for (const name of names) {
    insert.run(name)
  }
  return names.length
})

// 执行事务
const result = transaction(["Alice", "Bob", "Charlie"])
console.log(result) // 3

// 事务函数可以接收任意参数
const updateUser = db.transaction((id, data) => {
  db.prepare("UPDATE users SET name = ?, age = ? WHERE id = ?").run(data.name, data.age, id)
})
updateUser(1, { name: "Alice Updated", age: 26 })
```

### 3.2 事务类型

SQLite 支持三种事务类型，better-sqlite3 都支持：

| 类型        | 方法                           | 锁级别         | 说明                                                 |
| ----------- | ------------------------------ | -------------- | ---------------------------------------------------- |
| `DEFERRED`  | `db.transaction(fn)`           | 延迟获取锁     | 默认。第一个读操作获取共享锁，第一个写操作获取保留锁 |
| `IMMEDIATE` | `db.transaction.immediate(fn)` | 立即获取保留锁 | 事务开始时就获取保留锁，其他连接可以读但不能写       |
| `EXCLUSIVE` | `db.transaction.exclusive(fn)` | 立即获取排他锁 | 事务开始时就获取排他锁，其他连接既不能读也不能写     |

**示例：**

```js
// 默认 DEFERRED
const t1 = db.transaction(() => {
  /* ... */
})

// 显式指定类型
const deferred = db.transaction.deferred(() => {
  /* ... */
})
const immediate = db.transaction.immediate(() => {
  /* ... */
})
const exclusive = db.transaction.exclusive(() => {
  /* ... */
})

// 使用场景
// - 只读事务：用 DEFERRED（默认）
// - 读写事务，减少锁等待：用 IMMEDIATE
// - 需要完全隔离：用 EXCLUSIVE
```

> **选择建议**：大多数情况用默认的 DEFERRED 即可。如果事务中先读后写，且并发较高，可以用 IMMEDIATE 减少死锁概率。

### 3.3 嵌套事务

better-sqlite3 支持嵌套事务，内部使用 SQLite 的 `SAVEPOINT` 实现。

```js
const insert = db.prepare("INSERT INTO users (name) VALUES (?)")

// 外层事务
const outer = db.transaction((users) => {
  for (const user of users) {
    try {
      // 内层事务（自动使用 SAVEPOINT）
      inner(user)
    } catch (e) {
      console.log(`跳过 ${user}: ${e.message}`)
      // 内层事务回滚不影响外层
    }
  }
})

// 内层事务
const inner = db.transaction((name) => {
  if (name === "bad") throw new Error("无效名称")
  insert.run(name)
})

outer(["Alice", "bad", "Bob"]) // Alice 和 Bob 会插入，bad 被跳过
```

> **注意**：嵌套事务中，内层事务回滚只回滚到内层保存点，不影响外层事务。外层事务回滚会回滚所有内容。

---

## 四、参数绑定

### 4.1 位置参数

用 `?` 占位，按顺序传参。

```js
// 单个参数
db.prepare("SELECT * FROM users WHERE id = ?").get(1)

// 多个参数
db.prepare("SELECT * FROM users WHERE age >= ? AND status = ?").all(18, "active")

// 用数字指定位置（从1开始）
db.prepare("SELECT * FROM users WHERE name = ?1 OR email = ?2").get("Alice", "alice@example.com")

// 复用同一参数
db.prepare("SELECT * FROM users WHERE name = ?1 OR nickname = ?1").get("Alice")
```

### 4.2 命名参数

用 `@name`、`$name` 或 `:name` 格式，传对象绑定。

```js
// @ 前缀
db.prepare("INSERT INTO users (name, age) VALUES (@name, @age)").run({
  "@name": "Alice",
  "@age": 25
})

// $ 前缀
db.prepare("INSERT INTO users (name, age) VALUES ($name, $age)").run({
  $name: "Bob",
  $age: 30
})

// : 前缀
db.prepare("INSERT INTO users (name, age) VALUES (:name, :age)").run({
  ":name": "Charlie",
  ":age": 35
})
```

> **注意**：对象的 key 必须包含前缀符号（`@`/`$`/`:`），不能省略。

### 4.3 数组参数

可以直接传数组，数组元素会按顺序展开。

```js
const params = ["Alice", 25, "active"]

// 数组会被展开为位置参数
db.prepare("INSERT INTO users (name, age, status) VALUES (?, ?, ?)").run(...params)
// 等价于 .run('Alice', 25, 'active')

// 也可以直接传数组（better-sqlite3 支持）
db.prepare("INSERT INTO users (name, age, status) VALUES (?, ?, ?)").run(params)
```

---

## 五、数据类型映射

### JavaScript → SQLite

| JavaScript 类型      | SQLite 类型                 | 说明                           |
| -------------------- | --------------------------- | ------------------------------ |
| `null`               | `NULL`                      | -                              |
| `undefined`          | `NULL`                      | 绑定参数时会转为 NULL          |
| `number` (整数)      | `INTEGER`                   | 安全整数范围内（-2^53 ~ 2^53） |
| `number` (浮点数)    | `REAL`                      | 非整数的 number                |
| `bigint`             | `INTEGER`                   | 支持 64 位整数                 |
| `string`             | `TEXT`                      | -                              |
| `boolean`            | `INTEGER`                   | `true` → 1，`false` → 0        |
| `Buffer`             | `BLOB`                      | 二进制数据                     |
| `Date`               | `TEXT` / `REAL` / `INTEGER` | 不自动转换，需手动处理         |
| `object` (非 Buffer) | 不支持                      | 需手动 JSON.stringify          |
| `symbol`             | 不支持                      | -                              |

### SQLite → JavaScript

| SQLite 类型 | JavaScript 类型      | 说明                                                          |
| ----------- | -------------------- | ------------------------------------------------------------- |
| `NULL`      | `null`               | -                                                             |
| `INTEGER`   | `number` 或 `bigint` | 安全整数范围内为 number，超出为 bigint（需开启 safeIntegers） |
| `REAL`      | `number`             | -                                                             |
| `TEXT`      | `string`             | -                                                             |
| `BLOB`      | `Buffer`             | -                                                             |

### 日期处理

SQLite 没有原生日期类型，常见做法：

```js
// 1. 存为 ISO 字符串（推荐，可读性好）
db.prepare("INSERT INTO events (title, created_at) VALUES (?, ?)").run("Meeting", new Date().toISOString())

// 2. 存为时间戳（数字，性能好）
db.prepare("INSERT INTO events (title, created_at) VALUES (?, ?)").run("Meeting", Date.now())

// 3. 用 SQLite 内置函数
db.prepare("INSERT INTO events (title, created_at) VALUES (?, CURRENT_TIMESTAMP)").run("Meeting")

// 读取时转换
const row = db.prepare("SELECT * FROM events").get()
const date = new Date(row.created_at) // ISO 字符串
const date2 = new Date(row.created_at) // 时间戳（毫秒）
```

### JSON 存储

```js
// 存储
const data = { name: "Alice", tags: ["a", "b"] }
db.prepare("INSERT INTO items (data) VALUES (?)").run(JSON.stringify(data))

// 读取
const row = db.prepare("SELECT data FROM items").get()
const parsed = JSON.parse(row.data)

// 或者用 SQLite 的 JSON 函数（SQLite 3.38+）
db.prepare("SELECT json_extract(data, '$.name') AS name FROM items").get()
```

### BLOB 二进制存储

```js
const fs = require("fs")

// 存储图片
const imageBuffer = fs.readFileSync("image.png")
db.prepare("INSERT INTO files (name, data) VALUES (?, ?)").run("image.png", imageBuffer)

// 读取
const row = db.prepare("SELECT data FROM files WHERE name = ?").get("image.png")
fs.writeFileSync("copy.png", row.data) // row.data 是 Buffer
```

---

## 六、错误处理

### SqliteError 类

better-sqlite3 的所有错误都是 `SqliteError` 实例，继承自 `Error`。

```js
const { SqliteError } = require("better-sqlite3")

try {
  db.prepare("INVALID SQL").run()
} catch (err) {
  if (err instanceof SqliteError) {
    console.log("错误码:", err.code) // 'SQLITE_ERROR'
    console.log("错误信息:", err.message) // 'near "INVALID": syntax error'
    console.log("错误栈:", err.stack)
  }
}
```

### 常见错误码

| 错误码              | 说明         | 常见原因                       |
| ------------------- | ------------ | ------------------------------ |
| `SQLITE_ERROR`      | 通用错误     | SQL 语法错误                   |
| `SQLITE_INTERNAL`   | 内部错误     | SQLite 内部 bug                |
| `SQLITE_PERM`       | 权限错误     | 文件权限不足                   |
| `SQLITE_ABORT`      | 中止         | 回调函数返回错误               |
| `SQLITE_BUSY`       | 数据库忙     | 其他连接持有锁，超时           |
| `SQLITE_LOCKED`     | 数据库被锁   | 表级锁冲突                     |
| `SQLITE_NOMEM`      | 内存不足     | 内存分配失败                   |
| `SQLITE_READONLY`   | 只读         | 尝试写入只读数据库             |
| `SQLITE_INTERRUPT`  | 中断         | 操作被中断                     |
| `SQLITE_IOERR`      | IO 错误      | 磁盘读写失败                   |
| `SQLITE_CORRUPT`    | 数据库损坏   | 数据库文件损坏                 |
| `SQLITE_NOTFOUND`   | 未找到       | 表/列不存在                    |
| `SQLITE_FULL`       | 磁盘满       | 磁盘空间不足                   |
| `SQLITE_CANTOPEN`   | 无法打开     | 文件路径错误或权限             |
| `SQLITE_PROTOCOL`   | 协议错误     | 锁协议错误                     |
| `SQLITE_SCHEMA`     | 模式错误     | 数据库模式变更                 |
| `SQLITE_TOOBIG`     | 数据过大     | 字符串/BLOB 超限               |
| `SQLITE_CONSTRAINT` | 约束违反     | UNIQUE/FOREIGN KEY/NOT NULL 等 |
| `SQLITE_MISMATCH`   | 类型不匹配   | 插入类型与列类型不匹配         |
| `SQLITE_MISUSE`     | 误用         | API 使用错误                   |
| `SQLITE_NOLFS`      | 不支持大文件 | 操作系统不支持大文件           |
| `SQLITE_AUTH`       | 授权失败     | 授权回调拒绝                   |
| `SQLITE_FORMAT`     | 格式错误     | 辅助数据库格式错误             |
| `SQLITE_RANGE`      | 范围错误     | 参数索引超出范围               |
| `SQLITE_NOTADB`     | 不是数据库   | 文件不是有效的 SQLite 数据库   |

### 约束错误详情

`SQLITE_CONSTRAINT` 错误会有更具体的扩展码：

```js
try {
  db.prepare("INSERT INTO users (email) VALUES (?)").run("duplicate@example.com")
} catch (err) {
  console.log(err.code) // 'SQLITE_CONSTRAINT'
  console.log(err.message) // 'UNIQUE constraint failed: users.email'
  // 常见约束错误：
  // - UNIQUE constraint failed: 唯一约束
  // - NOT NULL constraint failed: 非空约束
  // - FOREIGN KEY constraint failed: 外键约束
  // - CHECK constraint failed: 检查约束
  // - PRIMARY KEY constraint failed: 主键约束
}
```

### 错误处理最佳实践

```js
// 1. 连接时处理
let db
try {
  db = new Database("app.db")
} catch (err) {
  if (err.code === "SQLITE_CANTOPEN") {
    console.error("无法打开数据库文件，请检查路径和权限")
  } else if (err.code === "SQLITE_NOTADB") {
    console.error("文件不是有效的 SQLite 数据库")
  } else {
    console.error("打开数据库失败:", err.message)
  }
  process.exit(1)
}

// 2. 查询时处理
try {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId)
  if (!user) {
    console.log("用户不存在")
  }
} catch (err) {
  if (err.code === "SQLITE_BUSY") {
    console.error("数据库忙，请稍后重试")
  } else if (err.code === "SQLITE_LOCKED") {
    console.error("数据库被锁定")
  } else {
    console.error("查询失败:", err.message)
  }
}

// 3. 事务中处理
const transaction = db.transaction((data) => {
  try {
    // 操作
  } catch (err) {
    // 事务会自动回滚
    throw err // 重新抛出让调用者知道
  }
})
```

---

## 七、性能最佳实践

### 7.1 预编译语句复用

```js
// ❌ 错误：循环中重复 prepare
for (let i = 0; i < 10000; i++) {
  db.prepare("INSERT INTO users (name) VALUES (?)").run(`User${i}`)
}

// ✅ 正确：预编译一次，多次执行
const insert = db.prepare("INSERT INTO users (name) VALUES (?)")
for (let i = 0; i < 10000; i++) {
  insert.run(`User${i}`)
}
```

### 7.2 使用事务批量操作

```js
// ❌ 错误：逐条插入（每条都是一个事务）
const insert = db.prepare("INSERT INTO users (name) VALUES (?)")
for (let i = 0; i < 10000; i++) {
  insert.run(`User${i}`) // 慢！每次都要 fsync
}

// ✅ 正确：用事务包裹（一个事务，一次 fsync）
const insertMany = db.transaction((users) => {
  for (const name of users) {
    insert.run(name)
  }
})
insertMany(Array.from({ length: 10000 }, (_, i) => `User${i}`))
// 性能提升 100 倍+
```

### 7.3 WAL 模式

```js
// 开启 WAL（Write-Ahead Logging），提升并发读写性能
db.pragma("journal_mode = WAL")

// 配合 synchronous = NORMAL（WAL 模式下安全且更快）
db.pragma("synchronous = NORMAL")

// 设置 WAL 自动检查点
db.pragma("wal_autocheckpoint = 1000")

// 内存映射（可选，大数据库读性能提升）
db.pragma("mmap_size = 268435456") // 256MB
```

### 7.4 合理使用索引

```js
// 创建索引
db.exec("CREATE INDEX idx_users_email ON users(email)")
db.exec("CREATE INDEX idx_users_age_status ON users(age, status)")

// 复合索引遵循最左前缀原则
// 查询 WHERE age = ? 可以用索引
// 查询 WHERE age = ? AND status = ? 可以用索引
// 查询 WHERE status = ? 不能用索引（缺少最左列 age）

// 查看查询是否使用索引
db.prepare("EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = ?").get("test@example.com")
// 结果中包含 'USING INDEX' 表示使用了索引

// 避免索引过多（每个索引都会降低写入性能）
// 一般单表索引不超过 5 个
```

### 7.5 大数据量查询用 iterate()

```js
// ❌ 错误：一次性加载所有数据到内存
const users = db.prepare("SELECT * FROM huge_table").all()
for (const user of users) {
  process(user)
}

// ✅ 正确：用迭代器逐行处理
const stmt = db.prepare("SELECT * FROM huge_table")
for (const row of stmt.iterate()) {
  process(row)
}

// 提前终止时记得调用 return()
const iter = stmt.iterate()
for (const row of iter) {
  if (shouldStop(row)) {
    iter.return() // 释放锁
    break
  }
}
```

### 7.6 缓存大小

```js
// 设置缓存大小（负数表示 KB，正数表示页）
db.pragma("cache_size = -64000") // 64MB 缓存
// 默认约 2MB，读多写少的场景可以调大

// 页大小（创建数据库时设置一次即可）
db.pragma("page_size = 4096") // 4KB 页（默认）
// SSD 可以用 8192 或 16384
```

### 7.7 其他优化

```js
// 1. 外键约束（需要时开启，有性能开销）
db.pragma("foreign_keys = ON")

// 2. 临时表存内存
db.pragma("temp_store = MEMORY")

// 3. 批量插入时临时关闭同步（注意：崩溃可能丢数据）
db.pragma("synchronous = OFF")
// 批量插入...
db.pragma("synchronous = NORMAL") // 恢复

// 4. 用 raw() 提升查询性能
const rows = db.prepare("SELECT id, name FROM users").raw().all()
// 比默认对象模式快约 2 倍

// 5. 避免 SELECT *，只查需要的列
db.prepare("SELECT id, name FROM users").all() // ✅
db.prepare("SELECT * FROM users").all() // ❌ 不必要的列浪费内存和IO
```

---

## 八、常见问题

### Q1: better-sqlite3 是同步的，会阻塞事件循环吗？

**A**: 会阻塞，但 SQLite 操作通常非常快（微秒级），对于大多数应用影响可忽略。如果有非常耗时的查询（如全表扫描大表），可以：

- 用 `worker_threads` 放到独立线程
- 优化查询（加索引、分页）
- 用 `iterate()` 分批处理

### Q2: 如何在 Electron 中使用？

**A**: 需要重新编译原生模块：

```bash
# 安装 electron-rebuild
npm install --save-dev electron-rebuild

# 重新编译
npx electron-rebuild

# 或在 package.json 中配置 postinstall
"scripts": {
  "postinstall": "electron-builder install-app-deps"
}
```

### Q3: 支持多线程并发吗？

**A**: better-sqlite3 的 Database 对象**不是线程安全的**，不能在多个线程中同时使用同一个连接。每个线程应该创建自己的连接。SQLite 本身支持多进程/多连接并发，但 better-sqlite3 的单个连接实例只能在一个线程中使用。

### Q4: 如何处理大整数（64位）？

**A**: better-sqlite3 默认将整数转为 JavaScript number（安全整数范围 -2^53 ~ 2^53）。超出范围的整数会自动转为 BigInt（从 v7.0.0 开始）。也可以手动开启：

```js
const db = new Database("app.db")
// safeIntegers 选项在 function/aggregate 中可用
db.function("big_int", { safeIntegers: true }, () => BigInt(9007199254740993))
```

### Q5: 如何备份数据库？

**A**: 三种方式：

```js
// 1. 在线备份（推荐，不阻塞写入）
await db.backup("backup.db")

// 2. 序列化到 Buffer
const buffer = db.serialize()
require("fs").writeFileSync("backup.db", buffer)

// 3. 命令行（需要 sqlite3 CLI）
// sqlite3 app.db ".backup backup.db"
```

### Q6: 数据库文件越来越大怎么办？

**A**: SQLite 删除数据后文件不会自动缩小，需要手动清理：

```js
// 开启自动清理（建库时设置）
db.pragma("auto_vacuum = INCREMENTAL") // 或 FULL

// 手动清理（会阻塞，建议空闲时执行）
db.exec("VACUUM")

// 增量清理
db.pragma("incremental_vacuum(100)") // 清理 100 页
```

### Q7: 如何查看数据库大小和表信息？

```js
// 数据库页数
const pageCount = db.pragma("page_count", { simple: true })
const pageSize = db.pragma("page_size", { simple: true })
const sizeBytes = pageCount * pageSize
console.log(`数据库大小: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`)

// 所有表
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()

// 表结构
const columns = db.pragma("table_info(users)")

// 表行数
const count = db.prepare("SELECT COUNT(*) FROM users").pluck().get()
```

### Q8: 如何实现软删除？

```js
// 加 deleted_at 列
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    deleted_at TEXT  -- NULL 表示未删除
  )
`)

// 查询时过滤已删除
const activeUsers = db.prepare("SELECT * FROM users WHERE deleted_at IS NULL").all()

// 软删除
db.prepare("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(1)

// 恢复
db.prepare("UPDATE users SET deleted_at = NULL WHERE id = ?").run(1)

// 彻底删除（定期清理）
db.prepare("DELETE FROM users WHERE deleted_at < ?").run("2024-01-01")
```

### Q9: 如何做数据库迁移？

```js
// 用 user_version 跟踪版本
const currentVersion = db.pragma("user_version", { simple: true })

if (currentVersion < 1) {
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
  `)
  db.pragma("user_version = 1")
}

if (currentVersion < 2) {
  db.exec(`
    ALTER TABLE users ADD COLUMN email TEXT;
    CREATE INDEX idx_users_email ON users(email);
  `)
  db.pragma("user_version = 2")
}

// 也可以用迁移工具如 node-pg-migrate 的 SQLite 版本
```

### Q10: 内存数据库和文件数据库性能差多少？

**A**: 内存数据库读写都更快（无需磁盘IO），但数据不持久化。一般：

- 读操作：内存快约 2-5 倍
- 写操作：内存快约 10-100 倍（因为不需要 fsync）
- 适用场景：缓存、临时数据、测试

```js
// 内存数据库
const db = new Database(":memory:")

// 从文件加载到内存（加速读取）
const fileDb = new Database("app.db", { readonly: true })
const buffer = fileDb.serialize()
fileDb.close()
const memDb = new Database(buffer) // 内存副本，读超快
```

---

## 附录：API 速查表

### Database

| 方法                           | 说明            | 返回值      |
| ------------------------------ | --------------- | ----------- |
| `new Database(path, opts?)`    | 打开/创建数据库 | `Database`  |
| `db.prepare(sql)`              | 预编译语句      | `Statement` |
| `db.exec(sql)`                 | 执行多条 SQL    | `Database`  |
| `db.pragma(name, opts?)`       | PRAGMA 操作     | 数组/值     |
| `db.transaction(fn)`           | 创建事务        | 事务函数    |
| `db.function(name, opts?, fn)` | 自定义函数      | `Database`  |
| `db.aggregate(name, opts)`     | 自定义聚合      | `Database`  |
| `db.backup(dest, opts?)`       | 异步备份        | `Promise`   |
| `db.serialize()`               | 序列化为 Buffer | `Buffer`    |
| `db.loadExtension(path)`       | 加载扩展        | `Database`  |
| `db.close()`                   | 关闭数据库      | `undefined` |
| `db.on(event, fn)`             | 事件监听        | `Database`  |

### Statement

| 方法                      | 说明               | 返回值                         |
| ------------------------- | ------------------ | ------------------------------ |
| `stmt.run(...params)`     | 执行（无返回数据） | `{ changes, lastInsertRowid }` |
| `stmt.get(...params)`     | 获取一行           | 对象 / `undefined`             |
| `stmt.all(...params)`     | 获取所有行         | 数组                           |
| `stmt.iterate(...params)` | 迭代器             | Iterator                       |
| `stmt.raw()`              | 返回数组模式       | `Statement`                    |
| `stmt.pluck()`            | 只返回第一列       | `Statement`                    |
| `stmt.expand()`           | 展开嵌套列名       | `Statement`                    |
| `stmt.bind(...params)`    | 预绑定参数         | `Statement`                    |
| `stmt.columns()`          | 列信息             | 数组                           |

### Transaction

| 方法                           | 说明                  |
| ------------------------------ | --------------------- |
| `db.transaction(fn)`           | DEFERRED 事务（默认） |
| `db.transaction.deferred(fn)`  | DEFERRED 事务         |
| `db.transaction.immediate(fn)` | IMMEDIATE 事务        |
| `db.transaction.exclusive(fn)` | EXCLUSIVE 事务        |

---

> 本文档基于 better-sqlite3 v11.x 编写。
> 官方文档：https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
