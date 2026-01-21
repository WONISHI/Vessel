# vessel

# 技术栈

- electron
- react
- tailwindcss
- typescript
- shadcn/ui

# 工程创建

##  1. 项目初始化 (脚手架选择)

```JS
# 创建项目 (选择 React + TypeScript)
npm create @quick-start/electron@latest vessel -- --template react-ts

/**
 * √ Select a framework: » react
 * √ Add Electron updater plugin? ... No / Yes
 * √ Enable Electron download mirror proxy? ... No / Yes
 */

cd vessel
npm install
```

## 2. 配置 Tailwind CSS

根目录下运行

```js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

配置 tailwind.config.js： 你需要确保 Tailwind 能够扫描到你的 React 组件文件。

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}" // 注意路径匹配你的 renderer 目录
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

引入样式： 在 src/renderer/src/assets/index.css (或 main.css) 中添加：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### **WARN**

> 在 src/renderer/src/assets/index.css (或 main.css) 中添加
>
> @tailwind base;
> @tailwind components;
> @tailwind utilities;
>
>
>
> 会报'@tailwind components' is no longer available in v4. Use '@tailwind utilities' instead.和'@tailwind base' is no longer available in v4. Use '@import "tailwindcss/>preflight"' instead.
>

1. **卸载当前版本并安装 v3**

在项目根目录 (`E:\vessel`) 运行以下命令：

```JS
# 卸载 v4
npm uninstall tailwindcss

# 安装 v3 的最新稳定版 (指定 @3)
npm install -D tailwindcss@3.4.17 postcss autoprefixer
```

**2. 重新初始化配置**

为了防止配置文件格式残留，建议删除旧的配置文件并重新生成：

1. 手动删除根目录下的 `tailwind.config.js` (如果有) 和 `postcss.config.js` (如果有)。

2. 运行 v3 的初始化命令：

   ```JS
   npx tailwindcss init -p
   ```

3. 再次确认 `tailwind.config.js`

重新生成后，确保 `content` 依然是我们修改后的正确路径：

```JS
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

​	4. 再次保存 CSS

​	现在，回到 `src/renderer/src/assets/index.css` (或你放 CSS 的地方)，输入原来的代码，这次就不会报错了：

```CSS
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 3.配置别名

**初始化配置：** 你需要配置 `tsconfig.json` 和 `vite.config.ts` 以支持路径别名（通常是 `@` 指向 `src/renderer/src`），这是 shadcn 运行的前提。

**第一步：配置 TypeScript (让 VS Code 能看懂)**

在你的项目根目录下，找到 **`tsconfig.web.json`** 文件（如果没有，就找 `tsconfig.json`）。

在 `compilerOptions` 里面添加 `baseUrl` 和 `paths` 配置。

**修改后的 `tsconfig.web.json` 应该是这样的：**

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": [
    "src/renderer/src/env.d.ts",
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/preload/*.d.ts"
  ],
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",

    /* --- 添加下面这几行 --- */
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "src/renderer/src/*"
      ]
    }
    /* -------------------- */
  }
}
```

**注意：** 这里的路径是相对于项目根目录的，所以是 `src/renderer/src/*`。

**第二步：配置 Vite (让代码能跑通)**

打开根目录下的 **`vite.config.ts`**。

我们需要引入 `path` 模块，并在 `resolve.alias` 中添加映射。

**方案一：修改后的 `vite.config.ts` 参考如下：**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path' // 1. 确保引入了 resolve

export default defineConfig({
  // ... 其他配置保持不变
  plugins: [react()], // 这里可能还有 electron 插件，别动它

  resolve: {
    alias: {
      // 2. 添加这一行配置
      '@': resolve(__dirname, 'src/renderer/src')
    }
  }
})
```

因为你使用的脚手架 (`electron-vite`) 把配置文件改名了。

请在项目根目录下找一个叫 **`electron.vite.config.ts`** 的文件。

这个文件同时管理主进程、预加载脚本和渲染进程的配置。我们需要把别名配置加到 **`renderer` (渲染进程)** 的部分里。

**方案二：修改步骤**

打开 `electron.vite.config.ts`，按照下面的注释修改：

```TS
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  // 👇 重点改这里：renderer 部分
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

## 4.shadcn-ui初始化

根目录运行

### WARN

> PS E:\vessel\vessel> npx shadcn@latest init
> ✔ Preflight checks.
> ✖ Verifying framework.
>
> We could not detect a supported framework at E:\vessel\vessel.
> Visit https://ui.shadcn.com/docs/installation/manual to manually configure your project.
> Once configured, you can use the cli to add components.

出现这个错误是因为 **shadcn CLI 只认得标准的 `vite.config.ts`**，而你的项目使用的是 `electron.vite.config.ts`，所以它把你当成了“未知框架”。

既然自动初始化 (`init`) 走不通，我们就用**手动模式**来完成配置。这其实更稳妥，因为我们可以完全掌控路径。

请依次执行以下 4 个步骤（我都帮你准备好了代码，直接复制即可）：

**第一步：安装必要的依赖**

这些是 `init` 本来会自动帮你装的包，现在我们需要手动装一下。

```JS
npm install clsx tailwind-merge class-variance-authority lucide-react
```

**第二步：创建配置文件 `components.json`**

在项目**根目录**（`E:\vessel\vessel\`）下新建一个名为 `components.json` 的文件，并将以下内容复制进去。

> **注意**：我已根据你的 Electron 目录结构专门调整了路径配置。

```JSON
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/renderer/src/assets/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

**第三步：创建工具函数 `utils.ts`**

shadcn 的组件都依赖一个叫 `cn` 的小函数来合并样式。

1. 在 `src/renderer/src` 文件夹下，新建一个文件夹叫 **`lib`**。
2. 在 `lib` 里面新建文件 **`utils.ts`**。
3. 复制以下代码：

```JS
// src/renderer/src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// 注意这里加了 : string
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

**第四步：配置全局 CSS 样式**

打开你的样式文件 `src/renderer/src/assets/index.css`。

删除里面原有的内容（除了 `@tailwind` 那三行），把下面的 **CSS 变量** 粘贴进去。这决定了组件的默认颜色（Slate 风格）：

```JS
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
 
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
 
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
 
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
 
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
 
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
 
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
 
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
 
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
 
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
 
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
 
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
 
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
 
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
 
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
 
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
 
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### WARN

执行完成之后在根目录多了一个`@>component>ui>button.tsx`

#### 第一步：删除错误的文件夹

请手动删除根目录下那个新生成的 **`@`** 文件夹。

#### 第二步：修改根目录的 `tsconfig.json`

如果有`tsconfig.web.json`也是改`tsconfig.json`

打开项目根目录下的 **`tsconfig.json`**（注意是根目录那个，不是 `src` 里的），把 `compilerOptions` 补全。

它原本可能只包含 `files` 和 `references`，请把它修改为如下内容（重点是加入了 `baseUrl` 和 `paths`）：

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    /* 👇 核心修改：让工具能看懂 @ 符号 */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/src/*"]
    }
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

electron.vite.config.ts

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        /* 👇 加上这一行，让 Vite 也能识别 shadcn 的路径 */
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

