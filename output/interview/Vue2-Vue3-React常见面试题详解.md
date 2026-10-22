# Vue 2、Vue 3、React 常见面试题详解

> 面向中级前端岗位，兼顾基础理解、原理追问、代码题与项目实战。
>
> 整理日期：2026-10-22。主体覆盖 Vue 2 经典维护场景、Vue 3 Composition API，以及 React 17 项目维护与 React 18/19 常见差异。示例没有特别注明时，Vue 采用 Vue 3，React 采用函数组件。
>
> 本文按知识点组织，不声称来自某家公司的真实题库。答案、示例与场景分析为整理编写；关键 API 行为附官方资料。示例偏教学用途，网络接口需替换成实际服务，不能直接当完整生产实现。

## 怎么用这份文档

每道题先用 30～60 秒说出结论，再解释原理、给出例子，最后回答一个边界或取舍。不要背完一串 API 却说不清解决了什么问题。

- **P0：必会**。直接影响常规面试表现，优先能够脱稿解释。
- **P1：常见追问**。要求说明使用条件、坑点与排查方法。
- **P2：进阶补充**。理解动机和适用范围，不要求背内部源码行号。
- 项目部分以你之前提供的 CMS、竞赛管理端、H5、OA 等场景设计练习；以下方案不代表这些工作全部已由你实现，实际面试只能讲自己的真实贡献。

## 目录

- [一、Vue 通用基础与组件设计（01～20）](#part-vue-common)
- [二、Vue 2 原理与存量项目（21～35）](#part-vue2)
- [三、Vue 3 响应式与工程实践（36～60）](#part-vue3)
- [四、React 核心与 Hooks（61～90）](#part-react)
- [五、React 性能、版本与工程（91～105）](#part-react-advanced)
- [六、结合简历的项目实战（106～120）](#part-project)
- [七、手写与代码判断（121～130）](#part-code)
- [八、易错结论速查与复习计划](#part-review)

<a id="part-vue-common"></a>
## 一、Vue 通用基础与组件设计

### 01. Vue 的数据驱动视图是什么意思？【P0】

**参考回答：**组件把状态声明为界面的输入，模板描述状态对应的结构。状态变化后，框架追踪依赖、调度组件更新并把差异应用到真实 DOM。业务代码主要维护状态，而不是在各个事件里手工修改节点。

例如“选中人数”应该由已选数组计算，不能勾选时手工给 DOM 文本加一、取消时再减一，否则分页、删除和回显容易漏掉同步路径。

**追问：MVVM 怎么理解？**可以用 Model、View、ViewModel 解释状态和视图的连接，但不要把 Vue 理解为只能双向绑定。组件间仍应保持清晰的单向数据流。`v-model` 也有明确的属性与更新事件契约。

**易错：**数据驱动不是完全不能操作 DOM。焦点、选区、第三方图表和测量布局可以使用 DOM API，但要管理生命周期。

### 02. Options API 和 Composition API 怎么选择？【P0】

**参考回答：**Options API 按 `data`、`methods`、`computed` 等选项划分代码；Composition API 能把同一业务的状态、派生值、监听和清理组织在一起，适合复杂逻辑拆分及 TypeScript 推断。

小组件使用 Options API 也很清楚；复杂表单、上传流程、列表查询可以拆成组合式函数。选择依据是逻辑组织和团队维护成本，不是“Composition API 必然更快”。

**追问：组合式函数和普通工具函数有什么区别？**工具函数通常是无状态计算；组合式函数可以持有响应式状态、注册监听或生命周期，并明确返回可供组件消费的能力。调用位置应能关联正确的组件上下文。

参考：[Vue Composables](https://vuejs.org/guide/reusability/composables.html)。

### 03. computed、methods、watch 分别做什么？【P0】

- `computed`：表达派生状态，依赖不变时可复用计算结果。
- `methods`：执行动作或带参数的计算，模板重新执行时调用不会自动获得 computed 的依赖缓存。
- `watch`：响应数据变化执行副作用，例如请求、同步外部系统。

```js
const keyword = ref('')
const users = ref([])
const filtered = computed(() =>
  users.value.filter(user => user.name.includes(keyword.value))
)
```

过滤结果不必另外放一个 `ref`，再用 watch 同步。那会产生两个需要维护的数据源。

**追问：computed 能发请求吗？**不应在 getter 中放请求、写状态等副作用；异步请求和加载状态应另行建模。`Date.now()` 也不是响应式依赖，单独把它放进 computed 不会让时间持续更新。

参考：[Computed Properties](https://vuejs.org/guide/essentials/computed.html)。

### 04. Vue 的生命周期有哪些？父子组件顺序怎样理解？【P0】

Vue 2 常见：`beforeCreate → created → beforeMount → mounted → beforeUpdate → updated → beforeDestroy → destroyed`。Vue 3 对应销毁阶段改为 `beforeUnmount / unmounted`，Composition API 通常在 setup 中初始化，并注册 `onMounted` 等钩子。

普通同步父子首次挂载可概括为：父创建、父挂载前、子创建、子挂载完成、父挂载完成。一次父子共同更新通常是父更新前、子更新前、子更新后、父更新后。

**边界：**异步组件、Suspense、条件分支不适合套死一张顺序表；父组件 mounted 不意味着全部异步子组件已经可用。

**实践：**读取 DOM 在挂载后；订阅、计时器、图表实例在卸载前后清理。缓存组件还需要处理激活和停用。

参考：[Lifecycle Hooks](https://vuejs.org/guide/essentials/lifecycle.html)。

### 05. v-if 和 v-show 区别？【P0】

`v-if` 决定分支是否存在，切换时涉及组件创建、卸载及事件清理；`v-show` 保留节点和组件实例，通过 `display` 控制显示。

- 切换少、初始不展示、内部开销大的分支，优先考虑 `v-if`。
- 频繁切换且需要保留本地状态，可考虑 `v-show`。
- 隐藏后仍运行的监听、轮询、视频或图表不会自动因为 `v-show` 停止。

**追问：弹窗关闭后表单为何没重置？**先查组件是否只是隐藏、是否被缓存、表单库是否保留值，再决定主动 reset 还是销毁重建。

参考：[Conditional Rendering](https://vuejs.org/guide/essentials/conditional.html)。

### 06. v-for 为什么需要 key？能用索引吗？【P0】

key 为同级节点提供稳定身份，让框架在插入、删除、重排时把旧实例与正确的数据关联。它尤其影响输入框内容、组件内部状态和动画。

索引在列表完全静态、不会排序且没有依赖身份的状态时可以接受；可编辑、可插入、可排序列表应优先使用业务 ID。随机 key 会导致不必要的卸载重建。

**追问：key 是不是越唯一越好？**只需在同级范围内唯一且稳定；变化的时间戳虽然唯一，却不稳定。key 不等于自动降低所有渲染成本。

参考：[List Rendering](https://vuejs.org/guide/essentials/list.html)。

### 07. v-if 与 v-for 能写在同一元素上吗？【P0】

不建议。Vue 2 中同一节点通常是 `v-for` 优先；Vue 3 是 `v-if` 优先，因此迁移时可能拿不到循环变量。

```vue
<template v-for="item in items" :key="item.id">
  <UserRow v-if="item.enabled" :user="item" />
</template>
```

如果目的是筛选列表，通常更清楚的是先写 `computed` 得到有效数据，再循环。Vue 2 的 `<template v-for>` key 放置要求与 Vue 3 不同，维护旧项目时应按版本处理。

**追问：是否只为了性能？**主要是语义、作用域和迁移一致性，性能只是其中一部分。

### 08. v-model 的原理？修饰符有什么用？【P0】

原生输入控件的 `v-model` 会根据控件类型绑定值及相应事件：文本框、复选框和下拉框并不都使用同一事件。组件上的 v-model 则是“值向下传、更新事件向上发”的语法简化。

常见修饰符：`.trim` 去除两端空白；`.number` 尝试数字转换但不保证任何输入都得到合法业务数字；`.lazy` 使用 change 而非通常的输入过程同步。

**追问：金额能直接靠 `.number` 校验吗？**不能。空值、精度、小数位、负数范围和后端协议都要单独校验。中文输入法组合过程也不宜按每次键盘事件强制改写输入。

参考：[Form Input Bindings](https://vuejs.org/guide/essentials/forms.html)。

### 09. 组件通信有哪些方式？【P0】

| 关系 | 优先方式 | 注意事项 |
| --- | --- | --- |
| 父传子 | props | 不在子组件直接修改父级所有权的数据 |
| 子通知父 | emit | 明确事件名与数据结构 |
| 父定制子内容 | slots | 内容作用域与数据来源分清 |
| 祖先到后代 | provide/inject | 明确写入入口，避免隐式共享失控 |
| 多模块共享 | Vuex / Pinia | 不把所有局部 UI 都放全局 |
| 操作子组件能力 | ref + 暴露方法 | 适合 focus/validate，不替代正常数据流 |

**追问：事件总线为什么难维护？**订阅关系隐蔽、事件名冲突、解绑容易遗漏；需要明确注册、注销和事件契约。Vue 3 移除了实例的 `$on/$off/$once`，不能原样照搬 Vue 2 写法。

### 10. 为什么不建议直接修改 props？【P0】

父组件拥有数据，子组件直接改会造成来源不清，且可能被父组件下一次传值覆盖。对象和数组的嵌套属性有时技术上能改，不代表设计上合理。

可选方案：简单表单用 update 事件；需要“取消编辑”的弹窗创建本地草稿，确认后提交；真正共享状态则交给明确的 store/action。

**易错：**`{ ...props.user }` 只做一层复制，嵌套地址对象仍可能共享。是否深拷贝取决于编辑边界，不能对包含函数、Date 或复杂实例的数据随手 JSON 序列化。

### 11. 普通插槽、具名插槽、作用域插槽怎么理解？【P0】

插槽让调用者决定部分渲染内容；具名插槽区分 header、footer 等位置；作用域插槽由子组件向插槽函数提供数据。

```vue
<DataTable :rows="users">
  <template #cell-name="{ row }">
    <a @click="open(row.id)">{{ row.name }}</a>
  </template>
</DataTable>
```

模板表达式默认使用声明它的父级作用域，`row` 则来自子组件显式暴露的插槽参数。组件负责数据遍历，调用方负责具体展示。

**追问：为什么不是再传一个 HTML 字符串？**插槽保留组件、事件和作用域能力；HTML 字符串还涉及转义与注入风险。

参考：[Slots](https://vuejs.org/guide/components/slots.html)。

### 12. nextTick 是什么？能保证页面已经绘制吗？【P0】

Vue 会批量处理同步发生的数据修改。`nextTick` 用于等待相关 DOM 更新完成后再测量或操作节点。

```js
visible.value = true
await nextTick()
inputRef.value?.focus()
```

它不保证图片已经下载、字体已加载、异步子组件已出现，也不等于浏览器已经完成屏幕绘制。测量图片布局还要等待 load；需要根据浏览器帧安排操作时可结合 requestAnimationFrame，但也不能把所有异步问题都交给它。

**追问：多次赋值为何只更新一次？**调度器会在合适的刷新时机合并重复任务；普通同步读状态仍可立即得到赋值后的值。

### 13. 虚拟 DOM 是什么？一定比直接操作 DOM 快吗？【P0】

虚拟 DOM 是用 JavaScript 对象表示 UI 结构的方式，支持声明式描述、组件组合、跨平台渲染和更新比较。

直接修改一个已知文本节点，手写 DOM 可能更便宜；虚拟 DOM 的价值在于把复杂界面状态同步交给统一机制。性能还取决于组件结构、数据规模、编译优化和更新策略。

**追问：diff 的常见原则？**同一层比较，类型变化通常替换，类型相同继续比较属性与子节点，key 帮助匹配身份。不要回答成“求任意两棵树的最优编辑距离”，也不要认为虚拟 DOM 能消除 DOM 布局和绘制成本。

### 14. Vue 模板如何变成页面？【P1】

可以概括为：模板解析成 AST，经过结构与表达式转换后生成渲染函数；运行时执行渲染函数得到虚拟节点，再由渲染器挂载和更新真实节点。

Vue 3 编译器会利用静态结构、动态绑定标记等信息减少运行时工作。具体生成结果随版本和构建模式变化，面试重点是理解“编译阶段能提前知道哪些信息”。

**追问：运行时构建和完整构建？**预编译 SFC 的项目通常不需要在浏览器运行模板编译器。不能把用户提供的不可信字符串直接编译为模板执行。

### 15. 动态组件与异步组件的区别？【P1】

动态组件是在运行时决定渲染哪一个组件，例如 `<component :is="current" />`；异步组件解决组件代码何时加载，Vue 3 常用 `defineAsyncComponent(() => import('./Panel.vue'))`。

两者可以组合。异步组件需要考虑加载中、加载失败、超时与重试；动态切换是否保留状态由缓存策略和 key 等决定。

**追问：路由懒加载也要用 defineAsyncComponent 吗？**Vue Router 路由组件通常直接提供动态 import 函数，和普通异步组件 API 的用途应区分。

### 16. keep-alive 缓存什么？常见坑是什么？【P0】

KeepAlive 保留不再显示的组件实例及其状态，返回时触发激活逻辑，不是浏览器 HTTP 缓存。

常用 include/exclude 控制范围，max 限制缓存数量，缓存淘汰采用最近使用相关策略。被停用不等于卸载，定时器、请求和外部订阅不会因 DOM 消失自动全部停止。

**实践：**停用时暂停轮询和媒体，激活时按数据过期策略刷新；切换不同业务 ID 时确认是否需要不同 key。不要把所有页面无限缓存，否则容易留住大量表格和图表实例。

参考：[KeepAlive](https://vuejs.org/guide/built-ins/keep-alive.html)。

### 17. Vue Router 的 hash 与 history 模式区别？【P0】

hash 路由把前端路径放在 `#` 之后，片段不会作为 HTTP 请求路径发送给服务器；history 模式使用浏览器 History API，URL 更接近普通路径。

history 模式刷新深层地址时，服务器需要把对应前端页面路径回退到应用入口；接口和静态资源路径不能盲目回退，否则 404 会被错误返回成 HTML。

**追问：白屏怎么排查？**看入口资源状态码和 MIME、部署 base、路由 base、静态目录与服务端回退配置。不要看到刷新 404 就只改前端路由。

### 18. 路由守卫与动态权限路由怎么设计？【P0】

典型流程：判断认证状态；需要时加载用户与权限；把后端权限标识映射到前端受控路由表；注册允许的路由；重新解析目标地址；退出登录时移除动态路由及用户数据。

Vue Router 4 的守卫常直接返回 `false`、路由位置或不返回值，不必照搬每个分支都调用 next 的旧习惯。一次导航不要重复放行。

**易错：**菜单隐藏不等于鉴权，前端守卫不能代替服务端校验；后端传来的任意字符串不应直接成为不受控动态 import 路径。

参考：[Navigation Guards](https://router.vuejs.org/guide/advanced/navigation-guards.html)。

### 19. Vuex 与 Pinia 怎么回答？【P0】

Vuex 中 state 保存状态，getter 表达派生值，mutation 同步描述修改，action 可组织异步流程。Vuex 3 常见于 Vue 2，Vuex 4 支持 Vue 3。

Pinia 用 store 组织 state、getters、actions，没有单独 mutation 层，支持 Option Store 和 Setup Store。Pinia store 是响应式对象，直接解构状态可能丢失响应性；状态/getter 用 `storeToRefs`，方法可直接取出。

```js
const store = useUserStore()
const { user, loading } = storeToRefs(store)
const { logout } = store
```

**追问：持久化什么？**只保留需要恢复且可序列化的数据；登录态、敏感信息、SSR 每请求隔离和版本迁移都需单独考虑。

参考：[Vuex Guide](https://vuex.vuejs.org/guide/)、[Pinia Core Concepts](https://pinia.vuejs.org/core-concepts/)。

### 20. 通用组件怎么设计才不是过度封装？【P0】

从稳定重复点抽象：明确 props、事件、插槽、受控状态及错误反馈。业务差异通过配置或插槽表达，避免给一个组件塞入几十个含义不清的布尔参数。

例如选择器分清 `selectedIds`、当前页数据、搜索条件和加载状态，弹窗只负责交互，提交由明确事件触发。表单组件提供 validate/reset/focus 等有限能力，不暴露整个内部状态供调用方随意修改。

**追问：什么时候不抽？**只有一次、变化方向不清楚、抽象后更难读时先保持局部。复用应减少理解和修改成本，而不仅仅是减少代码行。

<a id="part-vue2"></a>
## 二、Vue 2 原理与存量项目

### 21. Vue 2 响应式原理是什么？【P0】

初始化时遍历需要观察的数据，为属性设置 getter/setter。渲染或计算等过程读取属性时收集依赖；写入属性时通知依赖更新；组件渲染通常经过调度而非立刻重复执行。

可用三个角色理解：Observer 处理观察，Dep 管理依赖，Watcher 代表需要随数据变化重新执行的工作。对象内部已有属性会递归观察。

**追问：是给所有变量都安装 getter 吗？**不是，是对被纳入 Vue 响应式系统的数据进行观察。闭包里的普通变量不会因为项目用了 Vue 自动响应。

参考：[Vue 2 Reactivity in Depth](https://v2.vuejs.org/v2/guide/reactivity.html)。

### 22. Vue 2 为什么检测不到对象新增、删除属性？【P0】

经典 Vue 2 在观察时为已有属性建立 getter/setter，之后直接新增的属性没有对应拦截，删除也无法通过那个属性的 setter 通知。

```js
this.$set(this.user, 'nickname', '小魏')
this.$delete(this.user, 'legacyField')
// 或替换已声明的响应式对象
this.user = { ...this.user, nickname: '小魏' }
```

优先把顶层字段在 data 中声明完整。`Vue.set` 不是给根实例随意补顶层响应式状态的万能工具。

**追问：后端动态表单字段怎么办？**在受观察的容器对象上用 set，或者构建新的完整对象后整体赋给已声明字段。

### 23. Vue 2 数组有哪些限制？【P0】

直接设置数组索引或修改 length 通常不会产生预期的响应式通知，使用 `$set` 或 `splice`：

```js
this.$set(this.rows, index, nextRow)
this.rows.splice(index, 1, nextRow)
this.rows.splice(nextLength) // 截断
```

Vue 2 对 push、pop、shift、unshift、splice、sort、reverse 等变更方法做了增强处理。但数组里已被观察的对象，其已有属性仍可以响应式更新。

**易错：**不能说“Vue 2 数组所有修改都监听不到”，也不能说“数组中对象属性变化也必然无效”。

### 24. 为什么 Vue 2 组件的 data 通常是函数？【P0】

同一组件会创建多个实例。通过函数为每个实例返回自己的状态，避免所有实例共享同一个可变对象。

```js
export default {
  data() {
    return { selectedIds: [], loading: false }
  }
}
```

**追问：返回一个模块级对象还有效吗？**如果每次仍返回相同的全局对象，依然共享。函数形式不是魔法，关键是创建独立的数据实例。

**应用：**多个上传控件互相影响、多个弹窗共用表单值时，先检查是否误用了共享引用。

### 25. Vue 2 中 this 为什么有时是 undefined？【P0】

Options API 里的 methods、生命周期依赖 Vue 按约定绑定实例。箭头函数没有自己的 this，如果把 methods 或钩子本身写成箭头函数，就不能获得期望的组件实例。

```js
methods: {
  load() {
    setTimeout(() => {
      this.loading = false // 继承 load 的 this
    }, 100)
  }
}
```

普通方法中嵌套箭头回调是合理用法；不要机械地认为 Vue 里任何箭头函数都错误。Vue 3 setup 不使用组件实例 this，应通过显式变量和 API 组织逻辑。

### 26. Vue 2 的 v-model 与 .sync 有何区别？【P0】

Vue 2 组件默认 v-model 使用 `value` prop 和 `input` 事件，可通过 `model` 选项改名；`.sync` 针对某个 prop 展开为 `update:propName` 事件监听。

```vue
<Editor v-model="text" />
<Dialog :visible.sync="visible" />
```

子组件通过 `$emit('input', next)` 或 `$emit('update:visible', false)` 发出修改意图，而不是直接改 prop。

Vue 3 的默认组件契约改为 `modelValue / update:modelValue`，支持参数化多模型，不应把两个版本的默认事件混在一起。

### 27. $attrs、$listeners、inheritAttrs 在 Vue 2 做什么？【P1】

Vue 2 `$attrs` 可拿到未被 props 消费的属性，`$listeners` 可拿到父级传入的事件监听；包装输入框时，可把外层能力透传给内部真正的输入控件。

`inheritAttrs: false` 允许控制自动继承位置。Vue 2 的 class/style 处理有自己的特殊规则，不应直接套 Vue 3 结论。

**追问：Vue 3 怎么变？**移除 `$listeners`，监听器进入 `$attrs`；声明在 emits 中的事件会被组件消费。多根节点需要明确把透传属性绑定到哪里。

参考：[Vue 3 Fallthrough Attributes](https://vuejs.org/guide/components/attrs.html)。

### 28. Mixin 的优点与问题是什么？【P0】

Mixin 能复用选项和生命周期，适合旧项目抽取重复能力。但来源不显式、命名容易冲突、依赖关系隐蔽，多个 mixin 组合后很难判断一个方法从哪里来。

同名选项按规则合并，生命周期钩子可以进入合并队列，不是简单把整个 mixin 覆盖掉。

**迁移思路：**先找清数据输入和输出，把表单校验、请求、计时器分别提成有显式参数与返回值的函数或组合式函数，再逐步替换，不要一次性改完全部组件。

参考：[Vue 2 Mixins](https://v2.vuejs.org/v2/guide/mixins.html)。

### 29. Event Bus 怎么使用，为什么容易泄漏？【P0】

Vue 2 常见做法是共享一个 Vue 实例，发送方 `$emit`，接收方 `$on`。问题在于订阅可能比组件活得更久，重复进入页面就注册多次，闭包还会持有旧组件状态。

应保存原始处理函数，在销毁时对指定事件、指定函数解绑，避免全局 `$off(event)` 把其他组件监听一起删掉。

**进阶追问：验证码桥接能否一直用 Bus？**可以在遗留架构中作为迁移手段，但要明确并发调用归属、取消、超时、唯一请求 ID 和清理机制。一次事件不能误完成多个业务请求。

### 30. $forceUpdate 为什么不应成为常规修复？【P1】

它要求组件重新渲染，但不会让本来没有被观察的数据自动补齐正确的响应式设计，也不能修复共享状态、错误 key 或异步竞态。

数据变了界面没变，依次检查：是否改了真正的状态源；是否是 Vue 2 新增属性/索引问题；是否修改了复制后的变量；是否被 props 或请求覆盖；是否组件根本没有挂载。

**面试表达：**我会先定位数据流和更新触发原因，只有特定外部集成场景才评估强制刷新，并说明为何无法通过正常状态更新完成。

### 31. Vue 2 的自定义指令适合什么场景？【P1】

适合封装聚焦、点击外部区域、底层 DOM 行为等需要直接接触元素的能力。Vue 2 常见钩子是 bind、inserted、update、componentUpdated、unbind；Vue 3 名称与组件生命周期更加接近。

重点不是背所有钩子，而是避免重复绑定：初始化时注册，更新时只调整必要逻辑，解绑时清理事件、观察器和计时器。

**追问：权限按钮适合指令吗？**可以负责展示行为，但它不构成服务端鉴权，也不要把复杂业务流程都塞入指令。

### 32. Vue 2 长列表、PDF 或图表卡顿怎么排查？【P0】

先分辨网络慢、JS 执行慢、节点多、布局绘制慢还是内存增长。用 Performance 记录主线程，用 DOM 数量和内存快照观察节点及实例。

长列表优先服务端分页、可视区渲染；PDF 按页渲染并限制保留页；图表减少重复创建，正确 dispose。大体积只读数据可以评估减少深层观察，但要保证后续替换方式与团队约定一致。

**易错：**防抖不能解决一次渲染十万节点的问题；骨架屏改善等待体验，不等于减少真实执行耗时。

### 33. Vue 2 到 Vue 3 迁移检查什么？【P0】

按风险分组：构建与依赖兼容、全局 API 改为应用实例、组件 v-model、事件 API、attrs/listeners、插槽、指令钩子、生命周期名称、过滤器、异步组件及第三方 UI 库。

选择一条完整业务链验证，例如登录→权限路由→表单→上传→提交→返回，再扩大范围。只让首页渲染出来不能证明迁移完成。

**追问：能否直接保留所有插件？**要逐个验证 Vue、Router、状态库、UI 组件及其插件版本关系，不能只改 package.json 的 Vue 版本。

参考：[Vue 3 Migration Breaking Changes](https://v3-migration.vuejs.org/breaking-changes/)。

### 34. Vue 2.7 与 Vue 3 是不是一回事？【P1】

不是。Vue 2.7 回移了一部分 Composition API 与 SFC 开发体验，但底层仍是 Vue 2 的观察与渲染体系，不能因此认为拥有 Vue 3 Proxy 的全部能力。

在旧项目中看到 setup 或 ref，不应马上套用 Vue 3 对对象新增、数组及集合响应式的所有结论。先确认运行版本、编译器与插件。

**实践：**面试讲“我维护 Vue 2 项目，同时使用组合式逻辑组织方式”是合理的；不要说“用了 Composition API 就完成 Vue 3 升级”。

### 35. Vue 2 项目中常见内存泄漏来源？【P0】

全局事件总线、window/document 监听、定时器、WebSocket、图表或地图实例、未断开的 Observer、缓存页面和持有 DOM 的模块级引用都可能延长对象生命周期。

排查应重复进入退出同一路径，对比 GC 后的堆、Detached DOM 和 Retainers。不是看到内存暂时上升就能判定泄漏。

**回答模板：**我先构造可重复操作，再用快照定位仍被谁引用，最后在销毁或停用时对称释放，并重复操作验证。只说“用了 beforeDestroy 所以内存不会泄漏”不够。

<a id="part-vue3"></a>
## 三、Vue 3 响应式与工程实践

### 36. Vue 3 相比 Vue 2 的核心变化？【P0】

从三个维度回答：

1. **数据层**：普通响应式对象采用 Proxy，ref 通过 value 的访问追踪变化；能支持更多对象操作与集合场景。
2. **组织方式**：Composition API、组合式函数、`<script setup>` 改善复杂业务组织与类型推断。
3. **渲染与平台**：编译提示、静态优化、Fragment、Teleport 等提升能力与可优化空间。

Vue 3 仍支持 Options API，不能说它被彻底废弃。也不要把 Vite、Pinia、TypeScript 统称为 Vue 3 内核，它们属于相关工具和生态。

**追问：为什么升级？**根据项目复杂度、依赖支持和团队维护成本回答，不能只说“新版本更先进”。

### 37. Proxy 为什么比 Object.defineProperty 更适合对象观察？【P0】

Proxy 拦截对象层面的操作，可以处理读取、写入、删除、属性存在性和遍历等行为；defineProperty 主要对已定义属性建立访问器，需要额外处理新增、删除和数组方法。

```js
const proxy = new Proxy(target, {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    return Reflect.set(target, key, value, receiver)
  }
})
```

Reflect 有助于保持访问器 receiver 等语义。Vue 还需管理依赖图、代理缓存、集合方法、调度与原始对象关系，绝不是一个 Proxy 就完整实现响应式。

**易错：**Proxy 不会自动让读取代理之前保存的原始对象引用也获得同样通知。

### 38. ref 和 reactive 怎么选？【P0】

`ref` 可包装基本类型与对象，通过 `.value` 访问；对象值通常会被转换为深层响应式对象。`reactive` 返回对象的代理，不适合直接包装数字或字符串。

```js
const total = ref(0)
const user = ref({ name: '' })
const form = reactive({ name: '', age: 0 })
```

需要经常整体替换对象时，ref 通常更直观；固定形状的表单可用 reactive。二者不是“ref 只能基本类型，reactive 只能复杂类型”的简单二分。

**追问：是否到处都能省略 .value？**不能。模板顶层、对象属性、数组和 Map 中的 ref 解包规则有区别，JavaScript 普通代码一般需要明确 `.value`。

### 39. reactive 解构为什么可能丢失响应性？【P0】

解构基本类型相当于取出当时的值，之后读取这个局部变量不再经过原代理的属性访问。

```js
const state = reactive({ count: 0 })
const { count } = state // 普通数字快照
const countRef = toRef(state, 'count')
const { count: linkedCount } = toRefs(state)
```

如果取出的值本来就是响应式嵌套对象，对其内部属性的操作可能仍有响应性，不能笼统说所有解构一定全部失效。

**版本补充：**Vue 3.5+ 在 `<script setup>` 对 `defineProps` 的解构有特定编译转换；这不等于任意 reactive 解构都自动修复。

### 40. toRef、toRefs、unref、toValue 区别？【P1】

- `toRef(obj, key)`：建立某个属性的 ref 连接，而非复制独立值。
- `toRefs(obj)`：把当前可枚举属性转换成一组关联 ref，适合返回和解构。
- `unref(value)`：如果是 ref 取 value，否则返回原值。
- `toValue(value)`：还支持 getter 输入，会执行 getter 取值，适合组合式函数接收“值/ref/getter”。

**追问：为什么传 getter？**`useFeature(() => props.id)` 能在调用方不提前取快照的情况下保留动态访问。组合式函数应在 watch/watchEffect 等追踪环境中读取这个 getter。

### 41. computed 的缓存什么时候失效？为什么要保持纯计算？【P0】

缓存围绕读取过的响应式依赖建立。相关依赖变化后，计算结果需要在后续使用时重新求值；业务上应关注“依赖是否变了、返回值是否稳定”，不要背某一小版本内部实现为永久规则。

getter 里改依赖、发请求或修改 DOM 会让计算产生副作用，难以预测触发次数，也可能造成循环。

**追问：每次返回一个新对象会怎样？**即使内部字段相同，新对象身份不同也可能触发下游工作。必要时让派生值的语义和引用稳定，但必须先完整读取依赖，不能为了缓存漏掉依赖收集。

### 42. watch 与 watchEffect 区别？【P0】

watch 显式声明来源，默认在来源变化时执行；watchEffect 首次立即执行，在同步运行期间自动收集访问到的依赖。

```js
watch(() => props.userId, id => loadUser(id), { immediate: true })
watchEffect(() => {
  document.title = `${name.value} - 用户中心`
})
```

watch 更适合来源明确、需要新旧值或精细控制的流程；watchEffect 适合依赖少且读取自然的同步副作用。

**易错：**异步 watchEffect 在第一个 await 之后才读取的响应式值不会自动被该次同步依赖收集覆盖。不是函数体里出现的所有变量都一定成为依赖。

### 43. deep watch 的 newValue 与 oldValue 为什么相等？【P0】

深层属性原地变化时，newValue 和 oldValue 可能仍引用同一个对象。deep 使内部变化被观察，不会自动为每一次变化制作深拷贝快照。

直接 watch reactive 对象与 watch 一个返回对象的 getter，其深度触发规则需要区分。对大表单应优先监听明确字段，避免无条件深遍历整棵大对象。

**追问：确实需要前后差异怎么办？**按业务保存快照、监听目标字段集合，或用可控的版本和变更记录。Vue 3.5+ 支持以数值限制 deep 遍历深度，使用前确认项目版本。

### 44. watch 的 flush 与异步清理怎么用？【P0】

默认回调通常发生在父更新后、当前组件 DOM 更新前；读取更新后的当前组件 DOM 可用 `flush: 'post'`。`flush: 'sync'` 同步执行，可能放大高频变更成本。

```js
watch(userId, async (id, _old, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  try {
    const response = await fetch(`/api/users/${id}`, {
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!controller.signal.aborted) user.value = data
  } catch (error) {
    if (!controller.signal.aborted) loadError.value = error
  }
}, { immediate: true })
```

上例在下一次执行或监听停止时取消旧请求。Vue 3.5+ 的 `onWatcherCleanup` 要在同步阶段注册，不能在 await 后才调用。这里用回调参数形式便于说明兼容写法。

参考：[Watchers](https://vuejs.org/guide/essentials/watchers.html)。

### 45. shallowRef 和 shallowReactive 解决什么问题？【P0】

浅层 API 避免把大型结构全部转换成深层响应式。`shallowRef` 主要追踪 `.value` 替换；`shallowReactive` 追踪对象根层属性。

```js
const rows = shallowRef([])
rows.value = nextRows // 替换会通知
// rows.value[0].name = '新名字' 通常不触发浅 ref 通知
```

适合大体积只读快照或外部状态管理结构，但更新必须遵守替换约定。确实原地改了内容时可在理解语义后使用 `triggerRef`，不宜到处手动触发来掩盖混乱设计。

**追问：是否有了 shallowRef 就不需要虚拟列表？**不是。它降低响应式开销，虚拟列表降低 DOM 和渲染规模，两者解决不同层面的问题。

### 46. markRaw、toRaw 是什么？【P0】

`markRaw` 标记对象跳过响应式代理，适合某些图表、编辑器和第三方类实例；`toRaw` 从代理取得原始对象，适合短暂接入外部系统。

`markRaw` **不是冻结对象**，也不自动销毁实例。根对象被标记不代表把其任意嵌套对象放进其他 reactive 容器后永远不会被代理，混合使用还要留意身份比较。

**实践：**用普通闭包或 shallowRef 保存第三方实例，创建后调用 API，卸载时执行 dispose/destroy。不要通过长期持有并修改原对象绕过正常状态更新。

### 47. effectScope 有什么作用？【P1】

它将一组响应式副作用放进同一个作用域，便于统一停止。适合动态功能模块、可独立释放的订阅以及组件外组织的组合能力。

```js
const scope = effectScope()
scope.run(() => {
  watch(source, update)
  watchEffect(syncSomething)
})
scope.stop()
```

组件 setup 同步创建的监听通常已有组件作用域管理。作用域停止不会自动知道所有外部资源，例如定时器、DOM 事件和 SDK 实例，仍需通过清理回调处理。

参考：[Reactivity API: Advanced](https://vuejs.org/api/reactivity-advanced.html)。

### 48. script setup 与普通 setup 区别？【P0】

`<script setup>` 是 SFC 编译语法，顶层声明可用于模板，无需手动 return。它仍然是在每个组件实例初始化时执行对应 setup 逻辑，不是整个文件只运行一次的普通模块逻辑。

`defineProps`、`defineEmits` 等是编译宏；不能把宏使用规则等同普通运行时函数。需要模块级逻辑时可按支持方式另写普通 script，但要防止错误共享可变状态。

**追问：defineProps 能使用 setup 中局部变量做运行时定义吗？**宏参数涉及提升，受作用域限制；具体用法应按编译器规则，不是所有普通变量都能直接引用。

### 49. defineProps 解构与默认值有哪些版本差异？【P1】

Vue 3.5+ 在同一 `<script setup>` 中对 props 解构提供响应式访问转换，并支持解构默认值。更早项目中，直接解构基本类型 props 常得到快照，通常用 props 对象访问、toRef 或 getter。

```ts
const props = defineProps<{ userId: string }>()
watch(() => props.userId, loadUser)
```

这是清晰且便于跨版本理解的写法。即使使用新版解构，`watch(userId, ...)` 也不能把一个取出的普通值当来源，应传 getter。

**易错：**编译器对 props 的处理不应扩展成“JavaScript 解构从此自动响应式”。

参考：[script setup](https://vuejs.org/api/sfc-script-setup.html)。

### 50. Vue 3 多个 v-model 与 defineModel 怎么用？【P0】

Vue 3 默认使用 `modelValue` 与 `update:modelValue`；带参数的模型使用对应 prop 与 update 事件。

```vue
<UserEditor v-model:name="name" v-model:age="age" />
```

Vue 3.4+ 的 `defineModel` 简化声明：

```vue
<script setup>
const name = defineModel('name', { type: String, required: true })
</script>
<template><input v-model="name" /></template>
```

**追问：子组件给 model 默认值有什么风险？**父值未定义而子有默认值时可能出现初始不同步。优先明确受控契约及父级初始值。

参考：[Component v-model](https://vuejs.org/guide/components/v-model.html)。

### 51. defineExpose 是什么？【P1】

script setup 组件默认不把内部所有变量和方法当作公共实例接口。通过 defineExpose 显式暴露父组件确实需要的能力，例如 focus、validate、reset。

```js
const input = ref(null)
function focus() { input.value?.focus() }
defineExpose({ focus })
```

不要暴露整个内部表单对象让父组件越过契约任意修改；这样会形成隐藏耦合。

**追问：异步初始化能随时 expose 吗？**宏及组件暴露需遵循 setup 的同步/编译规则，不能先 await 很久后再期望此前所有引用都被正常暴露。

### 52. provide/inject 为什么适合表单上下文？【P0】

它能让深层字段共享表单级注册、校验和状态，而不必逐层传递大量 props。建议提供响应式只读状态，以及明确的操作方法，由提供方集中修改。

```js
const form = reactive({ submitting: false })
provide(formKey, { state: readonly(form), registerField, validate })
```

普通对象不会因为被 provide 就自动成为响应式；同一份引用是否响应取决于它本身是什么。使用 Symbol 或类型化 InjectionKey 减少命名冲突。

**追问：字段卸载怎么处理？**注册与注销对称，移除校验和错误状态，防止动态字段删除后仍阻止提交。

参考：[Provide / Inject](https://vuejs.org/guide/components/provide-inject.html)。

### 53. Teleport 有什么用？【P1】

Teleport 改变一段内容的实际 DOM 挂载位置，组件的逻辑父子关系仍然保留。弹窗、通知经常需要逃离局部容器的裁剪或层叠上下文。

它不是把组件变成一个完全独立应用；props、inject 和逻辑关系仍按组件树工作。目标节点是否存在、服务端渲染输出和样式作用范围都要检查。

**追问：用了 Teleport 就不用管弹窗可访问性吗？**仍要处理焦点圈定、关闭后焦点恢复、ESC、滚动锁和 aria 语义。

参考：[Teleport](https://vuejs.org/guide/built-ins/teleport.html)。

### 54. Vue Suspense 与异步组件是什么关系？【P1】

异步组件负责异步加载组件定义；Suspense 在支持的异步依赖完成前组织 fallback 和内容切换，也涉及 async setup 等场景。

**边界：**Vue 官方仍将 Suspense 标记为实验性能力，使用前确认版本和团队接受程度。不能认为任意组件 mounted 后的 fetch 都自动被 Suspense 接管。

**追问：请求失败会自动显示错误页吗？**需要另外设计错误捕获、重试和状态，不能把 fallback 当成完整异常处理。

参考：[Vue Suspense](https://vuejs.org/guide/built-ins/suspense.html)。

### 55. Vue 3 diff 的最长递增子序列是什么作用？【P2】

在带 key 的子节点比较中，可先处理两端相同部分，再建立中间新旧节点对应关系。对仍存在节点的旧位置序列寻找最长递增子序列，可减少必要的 DOM 移动。

例如新顺序中某些旧节点相对顺序仍稳定，这些节点可以尽量不动；其他节点插入或移动到正确位置。

**易错：**LIS 只解决特定比较阶段的移动优化，不代表整个 diff 只有这个算法，也不是“所有情况下完全 O(n)”。中级面试重点是 key、身份和移动成本，源码细节属加分项。

### 56. Patch Flag、静态提升、Block Tree 如何理解？【P2】

模板编译器可以提前发现哪些节点或属性不变、哪些会变化。静态内容可以复用；动态标记帮助运行时缩小需要比较的内容；Block 相关组织帮助追踪动态后代。

例如只变化 class 的节点，运行时不必把所有潜在属性都按同等方式检查。

**追问：为何仍可能慢？**大列表、复杂计算、过多组件实例、图表和布局开销不会被编译提示全部消除。不要把编译优化当成业务性能设计的替代品。

### 57. v-once 与 v-memo 区别？【P1】

`v-once` 用于后续无需更新的内容；`v-memo` 按给定依赖是否变化决定是否复用对应子树的更新结果。

```vue
<div v-for="row in rows" :key="row.id" v-memo="[row === selectedRow]">
  {{ row.name }}
</div>
```

上例只用于说明语法：如果 row.name 还能独立变化而未被正确纳入更新条件，就可能出现陈旧 UI。依赖数组必须覆盖影响渲染的变化，实际业务不能随手照抄。

**易错：**v-memo 不是虚拟列表，也不等于“缓存真实 DOM 节点就彻底解决卡顿”。

### 58. Vue 3 性能优化按什么顺序做？【P0】

先建立可复现基线，再拆成加载与交互两类：加载看入口资源、路由分包、压缩、缓存和关键请求；交互看计算、组件更新、DOM 数量和绘制。

大列表可用服务端分页和窗口化；只读大对象可评估浅响应式；昂贵派生值合理缓存；减少无意义的 prop 变化；第三方实例避免被不必要代理。

**追问：怎么证明提升？**同设备、同网络、同数据、同操作，多次测量首屏或交互指标，区分冷缓存和热缓存，报告绝对值及分布而不只报百分比。

参考：[Vue Performance](https://vuejs.org/guide/best-practices/performance.html)。

### 59. 自定义组合式函数有哪些设计原则？【P0】

命名通常以 use 开头，但关键是输入、输出、生命周期和边界清楚。接收动态输入时明确值/ref/getter，返回状态及操作，不让调用者猜内部副作用。

请求类能力区分 loading、error、data；事件类能力返回 stop，或挂靠组件作用域自动释放；多个调用是否各自独立还是共享，要写清楚。

**追问：能不能在点击事件里才调用所有组合式函数？**纯响应式工具可能可以，但依赖当前实例注册生命周期或注入的能力不能随意挪到无组件上下文的异步位置。Vue 组合式函数也不等于 React Hooks 的调用顺序规则。

### 60. Vue 中 TypeScript 重点准备什么？【P0】

准备 props/emits 类型、ref 的空值、接口数据类型、联合类型缩窄、泛型组件或工具函数，以及模板类型检查。

```ts
type Status = 'idle' | 'loading' | 'success' | 'error'
interface User { id: string; name: string }
const user = ref<User | null>(null)
const emit = defineEmits<{ select: [id: string] }>()
```

类型来自编译阶段，不能保证服务端真实响应一定符合定义，外部边界仍需检查。

**追问：any 有什么问题？**会让错误继续向下传播。短期未知数据可从 unknown 开始，经校验缩窄；为了“通过编译”写一堆断言并不代表类型安全。

<a id="part-react"></a>
## 四、React 核心与 Hooks

### 61. React 的核心思想是什么？与 Vue 有何不同？【P0】

React 用组件表达 UI，通过 props 和 state 描述不同状态下的界面。函数组件在渲染时计算输出，事件更新状态，React 再协调变化。

Vue 通常通过响应式依赖追踪决定更新关联工作，React 函数组件则强调每次渲染的状态快照及显式不可变更新。两者都能构建声明式组件，都不应在渲染中发请求或任意修改外部状态。

**追问：React 是不是每次都重建整个 DOM？**重新执行组件函数不等于重建 DOM，协调后可能只提交很少变化。Vue 也不是“一个变量永远只更新一个真实节点”这么简单。

### 62. JSX 是什么？和 HTML 的区别？【P0】

JSX 是描述组件结构的 JavaScript 语法扩展，经构建工具转换成创建 React 元素的调用，不是直接交给浏览器解释的 HTML。

属性常用 `className`、`htmlFor`，事件传函数，表达式放 `{}` 中，样式对象使用 JavaScript 属性名。组件名通常大写，片段可避免多余 DOM 容器。

**安全边界：**普通文本插值会被转义，但 `dangerouslySetInnerHTML` 会进入原始 HTML 路径，必须有可信清洗策略。JSX 本身不是所有 XSS 的防护方案。

### 63. 函数组件与类组件的区别？【P0】

类组件通过实例与生命周期组织状态和副作用；函数组件每次渲染得到一组当前输入，通过 Hooks 管理状态、订阅和引用。

类组件的 this.state 合并更新与函数组件 useState 替换语义不同；函数闭包捕获某次渲染的值，也不能直接套用“始终读取同一可变实例”的理解。

**追问：函数组件没有生命周期吗？**它有挂载、更新和卸载过程，只是不建议把所有 Effect 机械一一对应为类生命周期。Effect 更适合围绕一个外部同步过程组织。

### 64. props 与 state 区别？【P0】

props 是调用方传入的输入；state 是组件需要记住并影响后续渲染的信息。两者在某次渲染内都应当作只读快照使用。

如果一个结果能由当前 props/state 计算，就不一定需要另存 state。例如完整姓名、筛选结果和已选数量通常可以直接派生。

**追问：把 props 放进 useState 为什么后面不更新？**初始参数只用于初始化该次组件状态，不是自动订阅 props。需要决定是受控数据、本地草稿还是 key 切换后的重新初始化，不能靠无条件 effect 覆盖所有编辑。

### 65. useState 为什么拿不到“刚 set 后”的值？【P0】

setter 请求后续渲染，不会改写当前函数闭包中的变量。当前事件看到的是这一轮 render 的快照。

```jsx
const [count, setCount] = useState(0)
function handleClick() {
  setCount(count + 1)
  console.log(count) // 仍是本次渲染中的值
}
```

不要笼统说“setState 永远异步”，更准确的是状态更新被调度，当前快照不会原地变。需要基于前值计算时用函数式更新；需要执行用户动作后的网络请求，可以用当场计算出的 next 值。

参考：[State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)。

### 66. 连续调用三次 setCount(count + 1) 加几？【P0】

在同一事件中，三次都读取同一个 count，通常只是重复请求同一个新值，结果增加 1。

```jsx
setCount(c => c + 1)
setCount(c => c + 1)
setCount(c => c + 1)
// 函数更新按队列计算，合计 +3
```

更新函数必须是纯函数，不能在里面发送请求或写入外部变量，因为开发检查或渲染策略可能让它被重新调用。

**追问：先替换后函数更新呢？**把操作当队列演算。例如初始 0，`setCount(5)` 再 `setCount(c => c + 1)` 得到 6。

参考：[Queueing State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)。

### 67. 批处理在 React 17 和 18 有什么不同？【P0】

React 17 的常见批处理主要覆盖 React 事件等受控范围；Promise、原生事件和定时器中的行为与之不同。React 18 使用 createRoot 的现代根后扩展自动批处理范围。

批处理是减少多次更新造成的不必要提交，不代表多个 setter 会把当前闭包变量立刻改掉。不同用户有意触发的独立事件不应被理解为永远合成一个事务。

**追问：flushSync 呢？**它可在少数与外部系统同步的场景强制刷新某些更新，代价较高，不应用于日常“我要马上读到新 state”。

### 68. 为什么 Hooks 不能写在普通条件分支中？【P0】

React 需要让同一组件多次渲染时的 Hook 调用保持可对应。把 useState/useEffect 放在条件、循环或提前 return 后面，会使调用数量或顺序不稳定。

```jsx
// Hook 总是在顶层调用，条件放到 Effect 内
useEffect(() => {
  if (!enabled) return
  const stop = subscribe()
  return stop
}, [enabled])
```

只在 React 组件或自定义 Hook 中调用普通 Hooks。

**版本边界：**React 的 `use` API 有专门例外规则，不要用它否定 useState/useEffect 的顶层要求。

参考：[Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)。

### 69. useEffect 的准确作用是什么？【P0】

Effect 用来让组件与外部系统同步，例如网络连接、计时器、浏览器事件和第三方图表。依赖变化时先清理旧同步，再启动新同步；卸载时也要清理。

```jsx
useEffect(() => {
  const connection = connect(roomId)
  connection.open()
  return () => connection.close()
}, [roomId])
```

Effect 通常在提交之后运行。不要把“总在浏览器绘制后执行”当绝对时序保证，用户交互等情况可能影响顺序。

**追问：能不能把所有业务写进 Effect？**用户点击触发的提交放事件里；纯派生数据在渲染中计算。Effect 不是生命周期垃圾桶。

参考：[useEffect](https://react.dev/reference/react/useEffect)。

### 70. useEffect 依赖数组三种写法区别？【P0】

- 不传数组：每次提交后都可能重新执行。
- `[]`：这段 Effect 不依赖组件中的响应式输入，正常生命周期中在初次挂载时建立同步，卸载时清理。
- `[id, token]`：对应值按 Object.is 比较发生变化时重建同步。

闭包里读取的 props/state/组件内函数通常都要考虑依赖。删掉依赖只是隐藏触发，不会让读取值变新。

**易错：**`[]` 不能保证开发模式绝对只执行一次；重新挂载也会重新执行。要调整依赖，应先调整代码结构而不是关闭 lint。

### 71. useEffect 为什么会死循环？【P0】

需要同时满足：Effect 更新某个状态；这个更新让某个依赖变化；依赖变化又触发 Effect。

常见情况是在 render 创建新对象并把它作为依赖，然后 Effect 里 setState。优先判断是否根本不需要这个 Effect，其次把对象创建放到 Effect 内，或把真实原始字段作为依赖。

**追问：能直接改成 [] 吗？**只有确实不依赖变化输入时才合理。否则会把死循环换成过期数据问题。useMemo/useCallback 可以稳定身份，但不应替代对错误数据流的修复。

### 72. 闭包陷阱是什么？计时器怎样拿到正确状态？【P0】

每次渲染都会创建闭包，旧计时器回调可能一直读取创建时的 count。

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1)
  }, 1000)
  return () => clearInterval(timer)
}, [])
```

基于旧值推导新值时函数式更新最直接。需要读最新多个输入时，可以重建订阅，或设计与提交同步的 ref/专门的事件逻辑；不能为了“最新值”在 render 中随意读写可变 ref。

**追问：useCallback([]) 能解决吗？**它可能只是把旧闭包缓存得更久，依赖错误仍在。

### 73. Effect 发请求怎样处理竞态和卸载？【P0】

例如先查 A 后查 B，A 晚返回不能覆盖 B。通过清理标志或请求序号阻止旧结果提交，同时支持时取消网络请求。

```jsx
useEffect(() => {
  const controller = new AbortController()
  let ignore = false
  setLoading(true)
  setError(null)
  async function run() {
    try {
      const response = await fetch(`/api/users/${id}`, {
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (!ignore) setUser(data)
    } catch (error) {
      if (!ignore) setError(error)
    } finally {
      if (!ignore) setLoading(false)
    }
  }
  run()
  return () => { ignore = true; controller.abort() }
}, [id])
```

忽略旧结果与取消请求解决不同问题。生产中还应考虑缓存、重复请求、分页和重试策略。

### 74. 为什么 Effect 回调不直接写 async？【P0】

Effect 的返回值需要是清理函数或 undefined；async 函数总返回 Promise，不符合这个返回约定。

应在 Effect 内定义并调用 async 函数，并同步返回清理。异步结果处理还要有错误分支、过期判断及取消，不是改个函数包装就完整了。

**追问：能 return fetch 吗？**不能把请求 Promise 当清理函数。类似地，Vue 和其他生命周期中也要区分回调支持的返回契约，不能任意把“释放逻辑”替换为返回一个对象。

### 75. useEffect 与 useLayoutEffect 区别？【P0】

useLayoutEffect 在 DOM 提交后、浏览器重绘前执行，适合必须先测量布局再调整位置、否则会闪烁的场景。它会阻塞绘制，因此不适合放一般网络请求或重计算。

useEffect 更适合大部分外部同步。服务端没有可测量布局，两者相关逻辑要考虑客户端边界。

**例子：**tooltip 必须根据真实高度选择上下位置，可以先测量再更新；普通埋点和请求不需要阻塞绘制。

参考：[useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)。

### 76. StrictMode 为什么让页面“执行两次”？【P0】

开发模式下，严格模式会额外检查渲染纯度，并对相关 Effect、ref 回调的建立与清理进行检查，帮助发现重复订阅、未清理资源和不可重入逻辑。

这不是生产环境把所有逻辑永远执行两次的承诺；具体启用位置和版本会影响检查范围。

**修复思路：**让订阅可清理、初始化可重入，用户动作提交放事件。用全局布尔量把第二次调用硬挡掉，可能掩盖真实卸载重挂载缺陷。

参考：[StrictMode](https://react.dev/reference/react/StrictMode)。

### 77. 哪些场景不需要 Effect？【P0】

筛选列表、拼接姓名、判断按钮禁用等纯派生结果直接在 render 算；用户点击后的保存请求写在事件；根据 key 切换整个编辑实体，可利用重置组件身份。

```jsx
const fullName = `${firstName} ${lastName}`
// 不必另建 fullName state 再用 Effect 同步
```

过多派生 state 会增加中间不一致状态和额外渲染。计算确实昂贵时再评估 useMemo，但其存在理由是优化，而非让数据流正确。

参考：[You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)。

### 78. useRef 与 useState 区别？【P0】

useRef 保存跨渲染的可变引用，修改 current 不触发渲染；useState 用于影响界面的状态。DOM、计时器 ID、外部实例等通常适合 ref。

```jsx
const inputRef = useRef(null)
const [visible, setVisible] = useState(false)
```

不要用 ref 保存界面上的选中人数，然后期待页面自动更新。也不要在 render 中任意修改 ref 来驱动当前输出，因为渲染可能重跑或被丢弃。

**追问：每次 useRef(new BigObject()) 都只创建一次吗？**参数表达式仍可能每次执行，需谨慎初始化昂贵对象。

参考：[useRef](https://react.dev/reference/react/useRef)。

### 79. useMemo 与 useCallback 区别？【P0】

useMemo 缓存计算结果，useCallback 缓存函数身份。依赖按 Object.is 比较，依赖变了就重新得到结果或函数。

```jsx
const visibleRows = useMemo(() => filterRows(rows, keyword), [rows, keyword])
const handleSelect = useCallback(id => setSelectedId(id), [])
```

缓存适合昂贵计算，或下游确实依赖引用稳定的场景。函数每次创建通常并不昂贵，给所有函数都套 useCallback 只会增加依赖维护。

**易错：**useCallback 不让函数自动读取最新状态；useMemo 也不能作为必须永久保存资源的机制。

参考：[useMemo](https://react.dev/reference/react/useMemo)、[useCallback](https://react.dev/reference/react/useCallback)。

### 80. React.memo 能阻止哪些渲染？【P0】

memo 可在 props 未变化时跳过由父组件更新带来的某些重新渲染，默认逐项按 Object.is 比较。组件自己的 state 更新、消费的 context 变化仍然可能使它重渲染。

如果父每次传新对象或新函数，浅比较容易失效。先稳定真实需要的输入，减少无关 props。

**追问：自定义比较函数注意什么？**必须正确比较影响输出与行为的输入，包括函数闭包；漏比回调可能让组件继续使用旧状态。比较本身也有成本，要测量。

参考：[memo](https://react.dev/reference/react/memo)。

### 81. useReducer 什么时候比 useState 合适？【P0】

多个状态经常一起变化、有明确事件和状态转移时，reducer 能把规则集中表达。例如上传流程区分 idle、hashing、uploading、merging、success、error。

```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'start': return { status: 'loading', error: null }
    case 'fail': return { status: 'error', error: action.error }
    default: return state
  }
}
```

reducer 必须纯净，网络请求和计时器放在事件或适当副作用中。useReducer 不是 Redux 的完整替代，也不天然带异步、中间件或跨组件共享。

参考：[useReducer](https://react.dev/reference/react/useReducer)。

### 82. Context 解决什么问题？为何可能影响性能？【P0】

Context 让后代读取共同输入，避免层层透传。Provider 的 value 变化会通知消费它的组件，memo 不能简单屏蔽真正的 context 更新。

把用户信息、主题、输入框状态和大型列表塞进一个不断变化对象，会使消费者受不相关变更影响。可拆分不同上下文，分离 state 与 dispatch，或使用提供选择性订阅的外部 store。

**追问：value 加 useMemo 就彻底解决吗？**只能减少依赖未变时的引用变化；value 中真正任一依赖变化，相关消费者仍可能更新。

参考：[useContext](https://react.dev/reference/react/useContext)。

### 83. 自定义 Hook 共享的是逻辑还是状态？【P0】

默认每次调用拥有各自的 Hook 状态，共享的是组织逻辑。两个组件都调用 useCounter，并不会自动获得同一个计数器。

要共享同一状态，应提升到共同父级、Context、store 或明确的外部订阅源。

**设计要求：**返回数据、加载、错误与操作入口；明确参数是否影响请求；清理资源；不要隐藏全局单例又让调用者以为每次独立。依赖数组是 Hook 内外协作契约的一部分，不应要求使用方猜怎样避免死循环。

### 84. 对象和数组 state 为什么要不可变更新？【P0】

保持旧快照不变，能让引用比较和历史渲染推理成立。原地修改后再 set 相同引用，可能不会触发期望更新，也会污染其他持有同对象的代码。

```jsx
setUsers(prev => prev.map(user =>
  user.id === id ? { ...user, name: nextName } : user
))
```

嵌套修改需要从目标到根复制相关路径；不要把浅拷贝理解为整个数据树都独立。结构过深时可规范化，或使用以草稿生成新状态的工具。

参考：[Updating Objects in State](https://react.dev/learn/updating-objects-in-state)。

### 85. React 的 key 为什么能重置表单？【P0】

状态与组件在树中的位置、类型和 key 等身份信息关联。同一个位置渲染不同 key，可使 React 视为新的组件实例，从而重置本地状态。

```jsx
<UserForm key={userId} userId={userId} />
```

适合切换编辑实体后应清空整份草稿的场景。若希望保留多个草稿，需要把草稿按 ID 提升保存，而不是只靠 key。

**易错：**在父函数里临时定义一个组件类型，每次重新创建，可能导致子组件意外重置；key 不稳定也会让输入光标、焦点和状态丢失。

参考：[Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)。

### 86. 受控组件与非受控组件区别？【P0】

受控输入由 value/checked 加 onChange 驱动，状态在 React 中；非受控输入通常用 defaultValue 初始化，后续真实值主要由 DOM 管理，需要时通过 ref 获取。

```jsx
<input value={name} onChange={e => setName(e.target.value)} />
```

输入生命周期中避免在 undefined 和明确字符串之间切换控制模式。文件输入有特殊限制，不能像文本框一样随意程序设置选择内容。

**取舍：**受控更易校验和联动，非受控可减少高频输入导致的顶层状态传播；大型表单要结合表单库的订阅和校验策略。

### 87. React 事件与原生事件有什么不同？【P1】

React 提供统一事件接口，并用事件系统协调绑定与传播；调用时传函数而不是执行函数结果。捕获和冒泡仍要按具体事件理解。

React 17 调整了主要事件委托位置，web 端也不再采用旧事件池方式，因此不能继续统一回答“异步读 event 必须 persist”。维护更旧版本需另查。

**追问：stopPropagation 能阻止默认跳转吗？**不能，默认行为使用 preventDefault；阻止传播与取消默认是两种行为。混合 React 和原生监听时要验证传播时机，不要只凭直觉。

### 88. ref、forwardRef、useImperativeHandle 怎么用？【P1】

父组件有时需要调用子输入框 focus 或表单 validate。React 17/18 函数组件通常借助 forwardRef 接收 ref，再用 useImperativeHandle 暴露有限方法。

React 19 支持把 ref 作为函数组件 prop，旧工程不可直接套新版用法。

**设计原则：**命令式接口只用于确实有必要的外部操作；显示隐藏、选中值等通常仍通过 props/state 表达。不要把内部 setter、DOM 和所有状态全部暴露给父级。

### 89. 错误边界能捕获哪些错误？【P1】

错误边界用于后代组件渲染等 React 管理流程中的错误，显示降级 UI 并记录故障。它不能自动捕获所有事件处理、任意 Promise 或定时器里的异常。

类组件可通过 getDerivedStateFromError 与 componentDidCatch 实现常见边界。函数式项目也可使用封装好的边界组件。

**追问：请求失败为何没进错误页？**通常要在数据层捕获，显示重试或按框架约定把错误交给渲染边界。边界自身失败还需要上层处理，日志不要携带完整敏感业务数据。

### 90. Portal 与普通渲染有什么区别？【P1】

Portal 让子内容挂到不同 DOM 容器，逻辑仍属于原 React 树，Context 和 React 事件传播按相应逻辑树处理。

适合弹窗、浮层和通知，减少局部 overflow 或层叠上下文影响。仍要清理容器，管理焦点、键盘、滚动锁与关闭回调。

**Vue 对照：**可类比 Teleport 的目标，但不要假设两个框架在事件实现和 API 细节上完全一致。DOM 放在 body 并不意味着事件完全脱离原组件关系。

<a id="part-react-advanced"></a>
## 五、React 性能、版本与工程

### 91. render、commit 和浏览器绘制有什么区别？【P0】

render 阶段计算应该出现的 UI，可能重新执行、暂停或放弃；commit 把选定结果应用到 DOM 等宿主环境；浏览器随后按自己的流水线进行样式计算、布局和绘制。

因此 render 必须纯净，不发送支付请求、不改外部数组、不创建无法清理的订阅。DOM 更新也不意味着像素已经绘制到屏幕。

**追问：为什么组件日志打印了但界面没变？**函数可能重新计算出相同结果，或该次渲染没有提交。只靠 console 次数衡量 DOM 更新和性能并不可靠。

参考：[Render and Commit](https://react.dev/learn/render-and-commit)。

### 92. Fiber 与并发渲染怎样理解？【P2】

Fiber 可理解为组件工作及其关联关系的一种内部表示，让渲染工作能够被拆分、调度和记录。并发渲染强调可中断、可重新开始以及不同更新优先级，不等于 JavaScript 组件同时在多个线程执行。

React 可以先服务紧急输入，再处理较低优先级界面；最终提交仍需保持一致性。长时间同步业务计算若本身阻塞主线程，也不会自动被 Fiber 拆开。

**追问：是否所有更新默认都有时间切片？**具体与版本、根模式、更新类型和调度有关，不能一句话覆盖。面试应先说明机制价值，再说项目是否真正使用了相关 API。

参考：[React 18 Overview](https://react.dev/blog/2022/03/29/react-v18)、[ReactFiber 源码](https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiber.js)。

### 93. useTransition 与 useDeferredValue 区别？【P1】

useTransition 让你把某些状态更新标记为非紧急，并提供 pending 状态；useDeferredValue 为某个输入提供可延后的版本，适合消费方无法直接控制更新源时使用。

输入框本身要及时更新；昂贵结果区域可以使用延后值。它们不是固定毫秒的防抖，也不会自动减少所有网络请求次数。

```jsx
const [text, setText] = useState('')
const deferredText = useDeferredValue(text)
return <><input value={text} onChange={e => setText(e.target.value)} />
  <MemoizedResults query={deferredText} /></>
```

**版本边界：**React 18/19 的异步 Action 支持有差异；await 后更新的优先级处理要按对应版本核对，不能把任何 async 回调都当完整过渡事务。

参考：[useTransition](https://react.dev/reference/react/useTransition)、[useDeferredValue](https://react.dev/reference/react/useDeferredValue)。

### 94. lazy 与 Suspense 如何实现代码分割？【P0】

```jsx
const Report = lazy(() => import('./Report'))
function App() {
  return <Suspense fallback={<Loading />}><Report /></Suspense>
}
```

lazy 通常声明在组件外，避免每轮渲染创建新的组件身份。模块默认导出应符合 lazy 的加载约定；加载失败需要错误边界和重试设计。

Suspense 可以处理其支持的挂起来源，但普通 useEffect 中请求接口不会因为外面包了 Suspense 就自动显示 fallback。数据挂起一般依赖框架或兼容的数据层。

参考：[lazy](https://react.dev/reference/react/lazy)、[Suspense](https://react.dev/reference/react/Suspense)。

### 95. CSR、SSR、SSG 与 hydration 怎么区分？【P1】

CSR 主要由浏览器执行代码形成内容；SSR 按请求在服务端生成 HTML；SSG 在构建阶段预生成；hydration 在已有服务端 HTML 上建立客户端框架交互能力。

收益和成本要一起说：首屏与可索引内容、服务端负担、缓存、动态性和客户端代码体积。SSR 不等于不需要 JavaScript，也不天然解决所有性能问题。

**易错：**服务端与客户端初次输出不一致会导致 hydration 问题，来源包括随机数、时区、无效 HTML、直接读取浏览器存储和不同初始数据。Vue SSR 也存在同类一致性要求，并需避免跨请求共享用户状态。

参考：[React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)、[Vue SSR](https://vuejs.org/guide/scaling-up/ssr.html)。

### 96. React 19 常见变化需要知道哪些？【P1】

优先理解与业务有关的变化：Actions 相关表单流程、useActionState、useOptimistic、use 读取受支持资源，以及函数组件 ref prop 等。

这些能力不能直接搬进 React 17 工程；升级前要核对 React DOM、类型、框架、表单库和构建工具兼容性。

**追问：知道 API 就算会用吗？**要解释待提交、失败回滚和重复提交。乐观更新尤其需要处理临时数据、服务端失败和并发操作，而不是“先 setState 就完成”。

参考：[React 19 Release](https://react.dev/blog/2024/12/05/react-19)、[use API](https://react.dev/reference/react/use)。

### 97. React Compiler 是否让 useMemo 全部没用了？【P1】

Compiler 是构建阶段优化工具，可自动处理部分组件、值和函数的记忆化。是否实际生效取决于项目是否接入、代码是否满足规则和编译覆盖范围，而不只是 React 主版本。

已有工程手写 memo 的代码不需要盲目一次删除；先确认编译状态和性能，再逐步调整。正确性仍不能依赖缓存永远不失效。

**追问：没启用 Compiler 怎么优化？**仍按测量、缩小状态范围、减少传播和必要手动缓存来做，不能援引新文档就假设老工程自动优化。

参考：[React Compiler Introduction](https://react.dev/learn/react-compiler/introduction)。

### 98. Redux、MobX、Context 怎么选？【P0】

Redux 强调显式 action、状态转移和可追踪数据流，现代项目通常结合 Redux Toolkit；MobX 通过 observable、依赖追踪与 observer 连接界面；Context 主要提供跨层传值，本身不是完整的数据管理和缓存方案。

选择看状态复杂度、更新频率、团队习惯、调试与测试成本，不是“项目大必须 Redux”。服务端数据缓存、请求失效和分页合并也不一定适合全部塞进普通全局 store。

**追问：局部弹窗状态要上全局吗？**没有跨页面消费、恢复或统一控制需求时，留在最近的合理组件层级通常更简单。

参考：[Redux Essentials](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)、[MobX Reactivity](https://mobx.js.org/understanding-reactivity.html)。

### 99. MobX 与 React 结合有哪些常见坑？【P1】

observer 组件在渲染期间读取的 observable 会形成相应追踪。过早取出普通快照、把读取放到不被追踪的异步流程，或者传给不支持 observable 的第三方组件，都可能导致预期外行为。

要理解值是在何时、何处被读取，必要时在合适边界转换数据或把读取下沉到 observer 子组件。异步 action 的更新边界也需要按项目 MobX 版本和配置处理。

**对应你的项目：**附件依赖是旧 MobX 主版本，面试中不要把现代 makeAutoObservable 写法说成该项目必然已经使用的实现。

参考：[MobX React Integration](https://mobx.js.org/react-integration.html)。

### 100. useSyncExternalStore 为什么存在？【P2】

它提供订阅外部 store 的 React API，需要稳定的 subscribe、能表示当前状态的 getSnapshot，以及 SSR 时对应的服务端快照。

快照在未变化时应保持相同身份，不能每次无条件返回新对象；React 用它判断外部状态是否变化并维持渲染一致性。

**追问：自己用 useEffect + forceUpdate 不行吗？**简单演示可能能跑，但并发与订阅一致性边界更复杂。业务通常选成熟库，而不是临时重写一个未经验证的外部状态连接层。

参考：[useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)。

### 101. React 页面性能优化怎么定位？【P0】

先区分请求慢、JavaScript 重计算、无效重渲染、DOM 数量、布局绘制与资源下载。用 React DevTools Profiler 看提交和组件耗时，用浏览器 Performance 看主线程全貌。

优化顺序可以是：缩小状态归属、拆分昂贵子树、减少 Context 波及、服务端分页/窗口化、稳定必要 props，再评估 memo 与缓存。

**追问：如何证明不是开发检查造成的错觉？**在可比较环境验证，考虑生产构建和 profiling 构建差异；记录同样数据量、操作和设备，而不是只看控制台少打印一次。

参考：[Profiler](https://react.dev/reference/react/Profiler)。

### 102. 大型表单为什么输入卡顿？【P0】

一个字符修改可能触发整张表单重渲染、全量深拷贝、所有字段同步校验和昂贵格式化。先记录耗时，确认是计算、渲染还是布局。

可把字段订阅粒度缩小，按变化字段校验，把异步校验防抖并处理竞态，避免每次输入重建全部字段配置。组件级 memo 只有输入稳定且工作可跳过才有效。

**追问：全部改成非受控就解决吗？**会改变数据读取、联动和校验方式，不是无成本优化。结合表单库现有能力和业务约束决定。

### 103. React Router 的路由与权限怎样回答？【P0】

先说明项目版本与路由模式。传统声明式路由通过 Route 等描述匹配；数据路由还可组织 loader/action 和错误边界。旧 Umi 工程也可能有自己的路由配置与权限层。

权限控制要区分路由可见、按钮可见、用户认证、接口授权。用户信息加载中应有明确中间态，避免先闪出无权页面再跳走。

**追问：退出后为何仍能看到上一用户数据？**除路由跳转，还要清理 store、缓存、在途请求与页面保活，按租户或用户隔离缓存键。

参考：[React Router Routing](https://reactrouter.com/start/declarative/routing)。

### 104. React + TypeScript 常问哪些类型问题？【P0】

准备 props、children、事件、ref、联合状态与泛型列表。用可辨识联合表达不会同时成立的状态，而不是一堆任意组合的布尔值。

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

type Props = {
  value: string
  onChange: (value: string) => void
  children?: React.ReactNode
}
```

**追问：ReactNode 与 ReactElement？**ReactNode 表示更广的可渲染内容；ReactElement 指元素对象。React.FC 不是函数组件唯一写法，children 是否隐含也要看类型版本，最好显式声明。

参考：[React TypeScript](https://react.dev/learn/typescript)。

### 105. Vue 和 React 项目如何做有效测试？【P0】

围绕行为验证：用户输入、校验提示、分页、提交成功或失败、取消请求、切换实体重置等。不要只测“调用了某个内部函数”或组件快照一字不差。

单元测试适合纯转换、规则、状态机；组件测试验证交互；端到端测试覆盖登录到提交的关键业务链。异步测试要主动控制请求返回顺序，才能测出竞态。

**追问：虚拟列表怎么测？**验证滚动后的可见范围、选择状态与业务 ID，不把当前 DOM 里的行数当作全部数据量。测试工具不能代替浏览器里的真实滚动、打印和低端机验证。

<a id="part-project"></a>
## 六、结合简历的项目实战

> 本节是答题框架与设计建议，不能把建议当作已做成果。准备时为每题补一个真实页面、一段个人代码和可验证结果。

### 106. 十万级名单页面卡顿，你会怎么优化？【P0】

先确认十万是服务端总量还是前端已加载量。若业务只需搜索和分页，不要先把全部记录拉到浏览器。必须本地处理时，把数据、计算和展示分层。

**方案展开：**服务端分页或游标查询；列表窗口化加适量 overscan；选择状态按业务 ID 保存；大型只读快照使用合适的浅层响应式；昂贵转换拆分或放 Worker；行内避免重复创建重型实例。

**难点追问：**变高列表如何测量和回填偏移；滚动时新增删除如何保持锚点；表格固定列与横向滚动怎样同步。

**验收：**记录 DOM 数量、交互延迟、滚动掉帧及内存。不能把“只渲染几十行”直接换算成“端到端快了 99%”。

### 107. 动态表单如何设计字段、校验与数据模型？【P0】

分开 schema、values、errors、visibility 和权限。字段使用稳定 ID，类型映射到受控组件；校验器按字段和依赖注册，不让 UI 层同时承担所有业务规则。

**典型难点：**隐藏字段是否保留值、是否参加提交；字段删除后清理校验；嵌套数组身份；异步校验结果过期；编辑历史数据时的 schema 版本兼容。

Vue 可以用 provide/inject 共享上下文，React 可以用 Context 或表单库订阅，但不是换成某个 API 就自动解决建模问题。

**追问：已有人报名的字段能删吗？**不能只删前端配置，要与后端约定使用中校验与兼容规则，避免历史记录无法解释。

### 108. React 题库分页新增与未保存状态怎么处理？【P0】

区分服务端已保存题目与本地草稿。草稿有稳定临时 ID，不能只用题号作唯一身份，因为插入删除会改变排序。

新增时明确总条数、目标页和加载顺序，避免 setPage 后立刻读旧 state。可把明确的 nextParams 传给请求函数，或围绕单一参数源触发请求，不要两套触发同时发请求。

**难点：**切页、批量删除、全选和审核前检查未保存项；新页请求比旧请求先返回时防覆盖；保存成功后用服务端 ID 替换临时 ID。

**追问：全选含义？**当前页全选、已加载全选、符合筛选条件的服务端全选是三个业务，不可混为一谈。

### 109. 多轮评分配置如何避免切换后遗留错误参数？【P0】

用明确模式区分数据结构，例如总分、分项、多轮、投票。字段只在适用模式参与提交，模式切换时重建合法默认结构或保留按模式隔离的草稿。

**校验层次：**字段校验负责必填与格式；组合规则校验负责轮数、分值和系数约束；服务端负责最终授权与业务一致性。

**追问：前端是否负责最终计算？**配置界面可以预览公式，但最终计分通常在服务端。简历若只做规则配置，不应说成独立研发评分计算引擎。

**测试：**每种模式从新建、编辑、切换到保存后回显都要覆盖，尤其测试旧字段是否混入新协议。

### 110. 视频分片上传、断点续传、秒传有什么区别？【P0】

分片上传是拆成小块后上传并合并；断点续传还要记录并查询已成功分片，只补缺失部分；秒传通常依赖服务端确认目标内容已存在且当前用户有权复用。

**完整设计：**文件标识、切片序号、大小、总片数；限并发上传；失败重试与退避；取消；合并幂等；进度以成功字节为准；校验合并结果。

大文件摘要可考虑 Worker 和增量读取，避免主线程阻塞或全文件一次读入内存。MD5 可用于非对抗场景内容标识，不应声称能提供强安全防篡改保证。

**项目答法：**若现有代码只有串行分片和合并，就诚实说明；断点恢复和并发属于后续改进设想。

### 111. 多媒体内容校对结果怎样关联原文？【P0】

把后端嵌套结果转换成统一展示模型，保留业务 ID、字段 ID、媒体类型、问题类别和原始定位信息，而不是只显示一句“校对失败”。

文字通过字段容器和命中片段定位；图片通过资源/字段 ID 标记；视频可按时间片、缩略图和问题类型导航。相同文字可能出现多次，需要确认命中范围而非全局随意替换。

**难点：**处理“排队中、处理中、失败、完成”，切换选手后旧结果不回写；重新校对时保留必要上下文。

**边界：**接入识别服务与展示结果不等于自行实现 NLP、OCR 或视频审核算法。

### 112. 菜单权限、按钮权限和接口权限怎么统一？【P0】

建立稳定的权限点标识，并映射到菜单、路由和操作。前端负责交互与展示，服务端负责每次敏感操作的授权和数据范围。

**异常路径：**用户权限加载失败、会话过期、角色变化、切换租户、动态路由未完成注册、缓存仍含旧用户信息，都要有处理。

**追问：本地改权限数组能不能越权？**正确的服务端授权下，修改前端只能改变可见性，不能获得接口权限。仅隐藏按钮或前端加密并不构成安全边界。

**项目表达：**说“实现前端权限展示并配合接口鉴权”，比“彻底保障数据绝对安全”更准确。

### 113. Wujie 等微前端场景状态和资源怎么管理？【P1】

先说明为何拆应用：团队与发布边界、存量框架共存、独立迭代等。接着解释主子应用路由、认证、通信协议、共享依赖与样式隔离。

**资源难点：**子应用卸载后，window 监听、全局 store、SDK、计时器和通信订阅是否仍存在；重复进入是否重复注册；缓存模式下生命周期与真正销毁有何区别。

状态共享应限定范围，提供有版本的事件或接口，避免主子应用都直接修改同一复杂对象。

**追问：effectScope 能清掉所有东西吗？**只能管理纳入其范围的响应式副作用，外部监听和实例仍要显式清理。具体沙箱行为按所用库和版本验证。

### 114. 图片和视频封面为什么用 IntersectionObserver？【P0】

浏览器可异步报告元素与视口或指定滚动容器的相交情况，减少自己高频计算每个元素位置的工作。可通过 rootMargin 提前加载，完成后 unobserve。

**难点：**自定义滚动容器、重复进入视口、请求并发、占位尺寸防布局跳动、节点卸载清理以及滚动时旧结果写回。

AbortController 可取消支持 signal 的请求；直接设置 img src 与自行 fetch Blob 不是完全相同的取消和缓存流程，不能笼统声称所有媒体请求都能由同一个控制器撤回。

参考：[Intersection Observer](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)、[AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)。

### 115. 移动端大 PDF 预览怎样降低内存？【P0】

先区分下载、解析、字体、页面栅格化和 canvas 缓冲。高 DPR 与多页同时渲染可能显著增加内存。

**方案：**只渲染可见与临近页，销毁远离区域的渲染资源；限制并发渲染任务和合理分辨率；按阅读位置加载；组件卸载时取消任务并释放实例。

**重要边界：**按页绘制不等于网络自动分段下载，是否 Range 请求取决于文件服务和预览库；骨架屏不等于解析更快。

**验收：**用具体文件页数、大小、设备、首屏可读时间和滚动后的峰值内存证明，不能直接说“带宽和内存都降低 80%”。

### 116. 组织树多选、全选、半选和回显怎么实现？【P0】

先约定选择语义：选部门是否包含后代；新增子节点是否自动选中；禁用节点是否参与；搜索结果是否改变全选范围。

数据层使用稳定 ID 与索引，选中结果可以用 Set 保存；全选与半选根据有效子节点汇总。大树避免每次点击全树深遍历，考虑缓存关系和增量更新。

**难点：**扁平数据存在缺父、重复 ID、环；跨页或懒加载时尚未加载后代；相同部门 ID 在不同分组下是否冲突。

**Vue/React 对照：**Vue 2 数组和新增属性更新要留意观察限制；React 更新 Set 时创建新集合，避免原地修改同一引用。

### 117. 搜索请求防抖、取消与防竞态是什么关系？【P0】

防抖减少触发频率；取消尽量停止不再需要的工作；防竞态保证过时结果不覆盖新结果。三者互补。

```text
输入 A → 请求 A
输入 AB → 请求 AB
AB 先返回 → 显示 AB
A 后返回 → 必须丢弃 A
```

可以为每次查询分配递增序号，只接收最新序号；同时取消旧请求。分页查询、清空关键词、切换条件和组件卸载都要更新有效性判断。

**追问：取消能保证服务器没执行吗？**不能。尤其写操作还需要服务端幂等键、业务状态校验等措施。

### 118. 提交防重、请求消重与幂等怎样区分？【P0】

按钮 loading 或前端状态锁减少用户重复触发；请求消重合并或取消相同在途操作；幂等保障相同业务意图重复到达仍不产生重复副作用，关键通常在服务端。

**设计：**前端锁覆盖校验、上传与请求整个过程，finally 释放；后端按业务约定消费幂等键或唯一约束；失败后允许正确重试而不是永久禁用按钮。

**追问：两个不同请求参数只看 URL 能去重吗？**不能，至少明确方法、路径、规范化参数、用户和业务上下文。也不能把正常并行请求误删。

### 119. 验证码升级为何容易出异步问题？【P0】

涉及脚本加载、组件准备、用户操作、验证回调、业务请求和取消退出，多条异步链需要统一结束语义。

**推荐建模：**加载 SDK、等待验证、验证成功、验证失败、取消、超时；每个业务调用拥有唯一上下文，一次只完成自己的 Promise；重复打开或卸载时解除监听并结束等待。

**难点：**SDK 回调重复、脚本只加载一次、失败后可重试、不同页面并行发起、用户取消后业务仍继续。

**边界：**前端接入验证码不能证明高并发承载、验通率或后端风控完整性，需真实监控数据支持。

### 120. 怎么把项目难点讲成可信的面试答案？【P0】

使用“背景→约束→个人动作→方案取舍→验证→边界”。

**可练习的话术：**“运营需要在同一后台配置多类赛事。我的负责部分是报名字段编辑，难点是已报名字段不能随意删除、默认字段与自定义字段要能正确回显。我把展示配置与提交结构分开，并在删除时对接使用状态校验。验证覆盖了新增、复制、排序和历史活动编辑。批量活动规模由后台处理，我没有负责服务端复制实现。”

这是一段结构示范，不是替你认领实现。没有数据就说清覆盖场景与交付物；有指标就说明测量条件。准备 3 个能深入讲 5 分钟的案例，比给每个项目都写“极限优化”更有效。

<a id="part-code"></a>
## 七、手写与代码判断

### 121. 手写一个支持取消的防抖函数【P0】

**要求：**连续调用只在最后一次后的 delay 执行，保留 this 和参数，组件退出时能取消。此处演示尾部触发，不实现 leading、maxWait 或 Promise 返回值。

```js
function debounce(fn, delay = 300) {
  let timer = null
  function wrapped(...args) {
    const context = this
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(context, args)
    }, delay)
  }
  wrapped.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  return wrapped
}
```

**追问：**防抖处理搜索输入，节流限制连续高频执行。React 中不要每次 render 随意重新创建防抖器，也不能缓存一个永远读取旧 state 的回调。是否取消旧调用要根据业务决定。

### 122. 手写一个最小响应式系统【P1】

以下只演示普通对象单层属性的依赖收集和触发。支持 effect 重跑前清理旧依赖，避免条件切换后一直订阅废弃分支。

```js
const targetMap = new WeakMap()
let activeEffect

function effect(fn) {
  const run = () => {
    for (const dep of run.deps) dep.delete(run)
    run.deps.length = 0
    const parent = activeEffect
    activeEffect = run
    try {
      return fn()
    } finally {
      activeEffect = parent
    }
  }
  run.deps = []
  run()
  return run
}

function track(target, key) {
  if (!activeEffect) return
  let depsMap = targetMap.get(target)
  if (!depsMap) targetMap.set(target, depsMap = new Map())
  let dep = depsMap.get(key)
  if (!dep) depsMap.set(key, dep = new Set())
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

function trigger(target, key) {
  const dep = targetMap.get(target)?.get(key)
  if (!dep) return
  // 快照：避免执行时清理、重新订阅造成集合遍历异常
  for (const run of new Set(dep)) {
    if (run !== activeEffect) run()
  }
}

function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key)
      return Reflect.get(obj, key, receiver)
    },
    set(obj, key, value, receiver) {
      const oldValue = Reflect.get(obj, key, receiver)
      const ok = Reflect.set(obj, key, value, receiver)
      if (ok && !Object.is(oldValue, value)) trigger(obj, key)
      return ok
    }
  })
}

const state = reactive({ enabled: true, a: 1, b: 2 })
effect(() => console.log(state.enabled ? state.a : state.b))
state.a = 3
state.enabled = false
state.a = 4 // 不再影响当前分支的 effect
```

**不具备的能力：**深层对象代理、代理缓存、delete/has/遍历、数组 length、Map/Set、调度去重、停止作用域、递归循环防护等。不能把这几十行称为完整 Vue 3 源码实现。

### 123. 写一个 Vue 3 事件监听组合式函数【P0】

```js
import { onMounted, onUnmounted } from 'vue'

export function useWindowEvent(type, handler, options) {
  onMounted(() => window.addEventListener(type, handler, options))
  onUnmounted(() => window.removeEventListener(type, handler, options))
}
```

**解释：**在浏览器挂载阶段访问 window，避免导入时直接触碰服务端不存在的对象；解绑使用同一个 handler 和一致的捕获配置。

**追问：**如果事件目标会变化，要监听目标引用，先解绑旧目标再绑定新目标；KeepAlive 停用是否暂停，需要按需求加入 activated/deactivated；不能因为注册在函数里就认为自动清理。

### 124. 写一个 Vue 3 防抖 ref【P1】

```js
import { customRef, onScopeDispose } from 'vue'

export function useDebouncedRef(initialValue, delay = 300) {
  let value = initialValue
  let timer = null
  onScopeDispose(() => clearTimeout(timer))
  return customRef((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(next) {
      clearTimeout(timer)
      timer = setTimeout(() => {
        value = next
        trigger()
      }, delay)
    }
  }))
}
```

应在有效的组件或 effect 作用域中调用。此实现延迟的是这个 ref 的可读新值，不只是延迟网络请求。

**追问：输入框手感怎样？**如果输入框也直接依赖这个延迟值，可能不符合实时输入需求。常见业务更适合保留即时输入 ref，单独防抖搜索参数；不能为了复用把所有状态都延迟。

### 125. 写一个 React useDebouncedValue【P0】

```jsx
import { useEffect, useState } from 'react'

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

输入 value 保持即时，查询使用 debounced。此 Hook 不主动发请求，不等于请求防竞态。

**追问：对象作为 value 呢？**每次 render 都新建对象会反复重新计时。应保持输入语义与引用合理稳定，或传具体原始字段，不能靠 JSON.stringify 所有对象掩盖问题。

### 126. 写一个 React interval Hook，如何避免旧回调？【P1】

```jsx
import { useEffect, useLayoutEffect, useRef } from 'react'

// 客户端示例；SSR 工程需按框架处理布局 Effect 的客户端边界。
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback)
  useLayoutEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay == null) return
    const timer = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(timer)
  }, [delay])
}
```

回调在提交后的布局 Effect 中同步，计时器读取最新已提交回调；delay 为 null 时暂停。并非在 render 任意写 ref。

**追问：轮询能直接 setInterval 请求吗？**接口耗时大于间隔会产生重叠。更稳妥的是本次结束后 setTimeout 安排下次，并加入取消、退避和页面可见性策略。

### 127. 写一个防竞态的 React 查询 Hook【P0】

```jsx
import { useEffect, useState } from 'react'

export function useJson(url) {
  const [state, setState] = useState({
    url: null, status: 'idle', data: null, error: null
  })

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    let active = true
    setState({ url, status: 'loading', data: null, error: null })

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (active) setState({ url, status: 'success', data, error: null })
      } catch (error) {
        if (active) setState({ url, status: 'error', data: null, error })
      }
    }
    load()
    return () => { active = false; controller.abort() }
  }, [url])

  if (!url) return { status: 'idle', data: null, error: null }
  // 新 URL 已 render，但对应 Effect 尚未执行时，不展示旧 URL 的成功结果。
  if (state.url !== url) return { status: 'loading', data: null, error: null }
  return { status: state.status, data: state.data, error: state.error }
}
```

**边界：**这是简单 GET 教学实现，没有缓存、去重、重试、分页合并或刷新入口。返回值把数据与请求参数关联，避免 A 的数据在 B 的标题下被短暂当作成功结果展示。

### 128. 写一个跨页选择状态更新函数【P0】

```js
function toggleSelection(previousIds, id, checked) {
  const next = new Set(previousIds)
  if (checked) next.add(id)
  else next.delete(id)
  return next
}

function setPageSelection(previousIds, pageIds, checked) {
  const next = new Set(previousIds)
  for (const id of pageIds) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

// React 示例：不原地改 prev
// setSelected(prev => toggleSelection(prev, row.id, checked))
```

**追问：全选十万条要下载十万个 ID 吗？**可以与后端约定 `allMatching + excludedIds + querySnapshot`，表示当前筛选全集减去排除项。需明确筛选变化是否重置，不能用当前 DOM 行数代表全量选择。

### 129. 手写一个限制并发的异步 map【P1】

```js
async function mapLimit(items, limit, mapper) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('limit must be a positive integer')
  }
  const results = new Array(items.length)
  let cursor = 0
  let stopped = false

  async function worker() {
    while (!stopped) {
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = await mapper(items[index], index)
      } catch (error) {
        stopped = true
        throw error
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return results
}
```

**解释：**结果按输入顺序保存，同时活跃 mapper 数量不超过 limit。一个任务失败后不再继续调度新任务，但已开始的任务不会自动停止。

**追问：上传失败如何重试或取消？**为 mapper 传 signal，设计重试次数与退避；失败策略可改为收集错误再返回。Promise.all 本身不提供网络取消。

### 130. 高频代码判断题：你能解释输出而不是猜吗？【P0】

**A. Vue ref 快照**

```js
const count = ref(0)
const snapshot = count.value
count.value++
console.log(snapshot, count.value) // 0, 1
```

snapshot 是普通值，框架不会追溯并改写所有复制出去的变量。

**B. Vue 解构**

```js
const state = reactive({ count: 0, profile: { name: 'A' } })
const { count, profile } = state
state.count++
profile.name = 'B'
```

count 是旧数字；profile 仍指向被代理的嵌套对象，修改 name 可影响读取该响应式属性的订阅者。不要笼统说全部失效。

**C. React 混合更新队列**

```jsx
// 当前 count 为 0，同一事件中：
setCount(count + 1)
setCount(c => c + 1)
setCount(count + 1)
```

通常最终为 1：替换成 1，再加成 2，最后又替换成当前闭包计算出的 1。

**D. React 修改同一数组引用**

```jsx
rows.push(newRow)
setRows(rows)
```

污染旧快照，并可能因同引用被跳过更新；应 `setRows(prev => [...prev, newRow])`。不要依赖其他 state 顺便触发渲染来“看起来能用”。

**E. Effect 的函数依赖**

```jsx
function load() { /* 使用当前 props */ }
useEffect(() => { load() }, [load])
```

每次 render 的 load 身份可能不同，导致重建 Effect。不是“依赖函数一定错误”，而是需要把逻辑放进 Effect、稳定必要函数或重构真正的依赖。还要检查 load 是否更新状态形成循环。

**F. key 变化**

```jsx
<Form key={Date.now()} />
```

父每次渲染都可能创建新身份，表单会不断重置；应使用稳定业务 ID，并只在业务上确实需要重置时改变 key。

<a id="part-review"></a>
## 八、易错结论速查与复习计划

### 8.1 面试中应避免的 24 个绝对说法

| 不准确说法 | 更准确的回答 |
| --- | --- |
| Vue 2 完全监听不到数组 | 变更方法有处理，直接索引/length 等有限制 |
| ref 只支持基本类型 | 也支持对象，默认对象值可深层响应式 |
| reactive 解构全部失效 | 取出基本类型会失去属性连接，嵌套代理另论 |
| defineProps 解构永远失效 | Vue 3.5+ 有特定编译支持，普通解构规则未变 |
| markRaw 冻结对象 | 跳过代理，不等于 Object.freeze |
| shallowRef 会追踪所有深层变化 | 主要追踪 value 替换，深层更新需遵守约定 |
| nextTick 等于页面已绘制 | 等待 Vue DOM 更新，不保证资源和绘制完成 |
| computed 适合放异步请求 | getter 应保持纯计算，请求属于副作用 |
| effectScope 清除所有资源 | 外部监听、定时器、SDK 仍需显式清理 |
| v-memo 就是虚拟列表 | 前者跳过特定更新，后者限制渲染节点规模 |
| key 越随机越能刷新性能 | 稳定身份才有利于正确复用 |
| React setState 永远异步 | 更应解释调度、快照及版本相关批处理 |
| [] Effect 永远只跑一次 | 还受重新挂载及开发检查影响 |
| Effect 永远在绘制之后 | 时机受更新来源影响，不作绝对保证 |
| useCallback 能自动获取最新值 | 依赖不正确仍是旧闭包 |
| useMemo 能永久保存资源 | 优化缓存不作为资源生命周期保证 |
| memo 能挡住所有重渲染 | 自身状态和 Context 等变化仍可触发 |
| useRef 改了界面就会更新 | current 修改不会触发渲染 |
| 自定义 Hook 自动共享状态 | 默认共享逻辑，每次调用各有状态 |
| 并发渲染是多线程执行组件 | 主要指可中断和优先级调度 |
| React 19 自动开启所有 Compiler 优化 | Compiler 是需确认接入的构建能力 |
| 取消请求能阻止服务端写入 | 仍需幂等、权限和业务状态校验 |
| 分片上传等于断点续传和秒传 | 后两者还需要专门协议及服务端能力 |
| 前端路由鉴权保证数据安全 | 服务端必须独立执行授权和数据范围校验 |

### 8.2 三分钟说清 Vue 2 / Vue 3 / React

**Vue 2：**能说明 defineProperty、依赖收集和调度，知道新增属性、数组索引限制；会处理 mixin、Bus、生命周期清理及旧项目迁移。

**Vue 3：**能说明 Proxy、ref/reactive、派生状态与副作用；会拆组合式逻辑，正确处理监听清理、第三方实例、大列表和组件契约。

**React：**能说明 render 快照、不可变更新、Hook 调用规则、Effect 同步与清理；会处理闭包、竞态、Context 传播、引用稳定和组件身份。

**共同能力：**先建模再选 API，能定位性能瓶颈，说明方案边界，并拿真实交付和验证结果支撑项目描述。

### 8.3 十天复习路线

| 天数 | 内容 | 当天产出 |
| --- | --- | --- |
| 第 1 天 | Vue 01～12 | 讲清 computed/watch、通信、key、nextTick |
| 第 2 天 | Vue 13～35 | 手写 Vue 2 更新案例，解释存量项目常见坑 |
| 第 3 天 | Vue 36～44 | 画出响应式依赖，完成监听取消请求示例 |
| 第 4 天 | Vue 45～60 | 讲清浅响应式、原始实例、组合式函数与迁移 |
| 第 5 天 | React 61～72 | 演算更新队列，解释闭包和 Effect 依赖 |
| 第 6 天 | React 73～90 | 写请求清理、受控输入、Context 和 memo 示例 |
| 第 7 天 | React 91～105 | 版本差异、性能定位、SSR 与类型练习 |
| 第 8 天 | 项目 106～120 | 选 3 个真实难点，分别讲 5 分钟并准备追问 |
| 第 9 天 | 手写 121～130 | 不看答案写出防抖、并发池与两个 Hooks |
| 第 10 天 | 模拟面试 | 录音复盘，修正空泛、越界和无证据指标 |

### 8.4 自测评分

每题按四项各 1 分：能给结论、能解释机制、能举例、能说边界。P0 题至少达到 3 分，项目重点题达到 4 分。仅能背名词但不会修改错误代码，按未掌握处理。

### 8.5 官方资料导航

以下链接用于按主题继续核对，已在正文对应题目附近提供关键参考；官方站点默认版本可能变化，阅读时留意项目版本。

- [Vue 2 指南](https://v2.vuejs.org/v2/guide/)、[Vue 2 API](https://v2.vuejs.org/v2/api/)
- [Vue 3 指南](https://vuejs.org/guide/introduction.html)、[响应式核心 API](https://vuejs.org/api/reactivity-core)
- [Vue 3 迁移指南](https://v3-migration.vuejs.org/breaking-changes/)
- [Vue Router](https://router.vuejs.org/guide/)、[Pinia](https://pinia.vuejs.org/core-concepts/)
- [React Learn](https://react.dev/learn)、[Hooks 参考](https://react.dev/reference/react/hooks)
- [React 17 事件相关变化](https://legacy.reactjs.org/blog/2020/08/10/react-v17-rc.html)
- [React 18](https://react.dev/blog/2022/03/29/react-v18)、[React 19](https://react.dev/blog/2024/12/05/react-19)
- [React Compiler](https://react.dev/learn/react-compiler/introduction)
- [自定义 Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Redux](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)、[MobX](https://mobx.js.org/understanding-reactivity.html)

---

**使用提醒：**本题集聚焦框架及项目相关能力。完整前端面试还需要单独复习 JavaScript 作用域与事件循环、原型与 this、Promise、TypeScript、CSS 布局、HTTP、浏览器渲染、网络安全和构建工具；不要用框架八股替代这些基础。
