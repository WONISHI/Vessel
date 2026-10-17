from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from pypdf import PdfReader
pdfmetrics.registerFont(TTFont('CN','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
OUT='output/pdf/魏志峰-中级前端工程师-新增竞赛管理端.pdf'
styles={
'name':ParagraphStyle('name',fontName='CN',fontSize=25,leading=32,textColor=HexColor('#152A43'),spaceAfter=6),
'contact':ParagraphStyle('contact',fontName='CN',fontSize=10,leading=17,textColor=HexColor('#506174'),spaceAfter=9),
'section':ParagraphStyle('section',fontName='CN',fontSize=13,leading=20,textColor=HexColor('#175B87'),spaceBefore=10,spaceAfter=7),
'title':ParagraphStyle('title',fontName='CN',fontSize=11,leading=17,textColor=HexColor('#152A43'),spaceBefore=6,spaceAfter=3),
'body':ParagraphStyle('body',fontName='CN',fontSize=9.5,leading=14,textColor=HexColor('#263444'),spaceAfter=4,wordWrap='CJK'),
'meta':ParagraphStyle('meta',fontName='CN',fontSize=8.5,leading=14,textColor=HexColor('#617183'),spaceAfter=4,wordWrap='CJK'),
'bullet':ParagraphStyle('bullet',fontName='CN',fontSize=9.5,leading=14,textColor=HexColor('#263444'),leftIndent=10,firstLineIndent=-9,spaceAfter=4,wordWrap='CJK')}
story=[]
def p(t,style='body'): story.append(Paragraph(t,styles[style]))
def section(t):p(t,'section')
def bullets(items):
 for x in items:p('• '+x,'bullet')
def project(title,desc,tech,items):
 p(title,'title');p(desc);p('技术栈：'+tech,'meta');bullets(items)

p('魏志峰','name')
p('中级前端工程师  |  广州  |  约 6 年前端开发经验<br/>电话：18797942292  |  邮箱：18797942292@139.com','contact')
section('个人优势')
p('以 Vue 2 / Vue 3 为主要技术栈，具备内容管理、政企协同办公、数据填报及移动端 H5 项目经验。能够承担业务模块开发、接口联调、公共组件封装与版本交付；在动态表单、组织树选择、文档预览、可视化编辑及存量系统改造方面积累了项目实践。')
section('专业技能')
bullets([
'框架与组件：熟练使用 Vue 2 / Vue 3、Vue Router、Vuex / Pinia，具备 Composition API 逻辑抽离、动态插槽与业务组件封装经验；具备 React + TypeScript 竞赛管理端及 UniApp 跨端开发经验。',
'页面与移动端：使用 HTML5、CSS3、Sass / Less、Flex / Grid 完成页面布局；使用 Vant、视口单位及安全区适配处理移动端页面，具备微信小程序原生开发经验。',
'复杂业务：具备动态表单、组织树级联选择、拖拽排座、PDF / Excel 在线预览、批量导出及 ECharts / AntV 数据展示等模块开发经验。',
'性能与工程：使用浏览器开发者工具排查渲染、网络和内存问题，实践过可视区渲染、媒体懒加载、异步组件与资源按需引入；具备 Vite / Webpack 配置和 Git 协作经验。'])
section('工作经历')
p('南方报业传媒集团  |  前端工程师  |  2024.06 - 2026.05','title')
bullets([
'参与 CMS 内容分发、活动资源管理及竞赛 H5 等项目开发，承担需求拆解、技术可行性分析、页面实现与接口联调。',
'参与 Vue 3 项目建设和存量业务重构，抽离公共逻辑与业务组件，处理大列表、媒体加载及第三方实例的性能问题。',
'协同产品、设计、后端与测试完成版本迭代，跟进兼容性修复、上线异常处理，维护组件接口与开发文档。'])
p('广州市省信软件有限公司  |  前端工程师  |  2019.11 - 2024.04','title')
bullets([
'参与政企 OA、会议管理、财政填报、网盘及微信小程序开发，完成表单工作流、人员选择、文档处理和数据展示等业务模块。',
'针对多个项目中的共性需求，封装组织树、动态校验、PDF 预览等组件与逻辑，并根据项目接口和交互要求进行适配。',
'参与项目环境配置、技术方案讨论、缺陷修复和上线跟进，编写接口及组件使用文档，支持后续维护与交接。'])
section('项目经历')
project('CMS 内容分发系统  |  前端工程师','面向内容运营人员的中后台系统，支持栏目、账号名单及内容分发管理。','Vue 3、Pinia、Vue Router、Wujie、Ant Design Vue、AntV',[
'参与基于 Wujie 的微前端重构，结合动态路由和路由守卫调整菜单与前端访问控制；管理登录态、全局配置同步及跨应用副作用的生命周期。',
'将栏目管理等业务逻辑抽离为组合式函数，结合动态插槽和多值 v-model 封装业务组件，拆分页面展示与数据处理逻辑。',
'针对大规模名单页面卡顿，实现可视区动态渲染，使用 shallowRef 减少不必要的深层响应式处理，并结合 v-memo 减少重复更新。',
'针对 AntV、Lottie、SVGA 等实例使用 markRaw 避免响应式代理；结合路由懒加载、组件按需引入与异步组件调整资源加载。'])
story.append(PageBreak())

p('魏志峰  /  React 项目经历','contact')
section('云竞赛平台管理端')
p('前端工程师  |  React / TypeScript 业务开发','title')
p('面向赛事运营人员的管理后台，覆盖现场竞赛、在线答题及科创竞赛的活动配置、报名审核、题库维护、评选与结果管理。')
p('技术栈：React 17、TypeScript、Umi 3、Ant Design 4、MobX、umi-request、SparkMD5','meta')
p('多步骤配置与预览','title')
p('参与多类型竞赛配置开发，基于 React Hooks 与 Ant Design Form 拆分活动信息、报名设置和规则配置；处理草稿保存、审核提交及数据回显，通过 iframe 消息传递对接 H5 预览。')
p('配置化报名字段','title')
p('参与配置化报名字段开发，支持短文本、长文本、图片、视频和 PDF 附件的新增、排序、复制及编辑；区分内置字段和自定义字段，并在删除前校验字段是否已被报名数据使用。')
p('多题型题库与编辑状态','title')
p('参与题库管理开发，覆盖单选、多选、判断及填空题，支持图文视频题干、模板导入、批量删除和题目下载任务；处理新增题目的分页定位，并在保存、审核和全选等操作前提示未保存题目。')
p('评选规则与模式切换','title')
p('参与评选规则配置，按活动、阶段和场次管理评审数据，支持单轮及多轮评分、总分或分项评分、投票和排名系数配置；处理模式切换后的数据重置与提交前业务校验。')
p('多媒体校对与内容定位','title')
p('参与多媒体内容校对结果展示，将不同竞赛类型的文本、图片和视频结果转换为列表数据，通过报名字段标识关联原始内容，支持文本命中高亮、媒体标记和重新校对。')
p('视频分片上传','title')
p('对接视频分片上传流程，基于 Blob.slice、FileReader 和 SparkMD5 处理文件切片及摘要，按序上传后调用服务端合并接口，衔接上传成功与失败回调。')
p('活动配置复用','title')
p('参与活动复制功能，按竞赛类型生成可选复制项，支持复用主页、规则和榜单配置，并对接创建人选择与后台复制任务，减少重复配置操作。')
story.append(PageBreak())
p('魏志峰  /  项目经历','contact')
project('百千万工程大数据云图平台  |  前端工程师','面向业务部门的活动资源管理与可视化平台，支持信息采集、资源管理及云图展示。','Vue 3、Pinia、Vue Router、Ant Design Vue、AntV、Vite',[
'基于 RBAC 角色配置过滤菜单，通过 addRoute 动态注册路由并结合全局守卫实现前端访问控制，支持不同职能部门使用各自业务功能。',
'将活动表单的字段配置与校验规则分离，利用 provide / inject 共享表单上下文，处理嵌套组件校验状态同步，减少复杂表单中的重复逻辑。',
'封装 useElementVisibility 组合式函数，通过 Intersection Observer 检测媒体元素可见性，按需加载图片和视频封面；使用 AbortController 取消不再需要的请求。',
'对接活动资源数据与 AntV 可视化展示，使用 markRaw 避免图表实例被响应式代理，支持业务数据更新与云图交互。'])
project('竞赛平台 H5 端  |  前端工程师','面向竞赛参与用户的移动端入口，承载登录、身份校验及竞赛互动相关流程。','Vue 2、Vuex、Vue Router、Vant、AliyunCaptcha.js',[
'完成阿里云验证码版本迁移，梳理验证触发、用户操作与结果反馈链路，封装通用验证码组件，为不同业务入口提供统一调用方式。',
'针对遗留项目调用链路，通过 Event Bus 桥接验证组件与 Store 请求逻辑，尽量减少对存量业务结构的改动。',
'利用 Promise 封装异步验证结果，衔接登录和身份校验流程，集中处理验证回调，减少多层回调带来的维护成本。',
'按需异步注入验证码脚本，避免在首屏加载非必要资源；处理超时、重试及移动端 WebView 兼容问题。'])
project('政企会议管理系统（保密项目）  |  前端工程师','面向政企会议组织人员，提供会议排座、桌牌配置、签到码导出及扫码核销功能。','Vue 2、Vuex、Vant、vue-draggable-resizable、vuedraggable、JSZip',[
'基于拖拽组件开发可视化排座画布，处理元素位置、方向和唯一标识，实现拖拽调整与辅助对齐，支持会议座位配置。',
'开发多图层桌牌编辑功能，支持样式配置及打印输出；使用 print-color-adjust 等样式处理打印场景中的背景色保留问题。',
'实现签到码批量生成，将图片 Blob 汇总为 ZIP 文件并通过 file-saver 下载，减少逐个生成、保存的操作。',
'利用 Mixin 与状态管理拆分动态表单校验逻辑；封装支持数据源接入、递归勾选和回显的部门及人员选择组件。',
'使用 vue-pdf 实现附件按页渲染；在构建配置中引入缓存机制，改善开发阶段的重复构建体验。'])
story.append(PageBreak())
p('魏志峰  /  项目经历与教育背景','contact')
project('政企移动 OA 与网盘（保密项目）  |  前端工程师','服务政企移动办公，覆盖公文拟稿、事务审批、组织通讯录，以及个人、处室、全厅和分享文件管理。','Vue 2、Vuex、Vue Router、Vant、Axios、vue-pdf、Sass',[
'开发公文与事务表单，分离字段展示和校验逻辑，依据可编辑区域执行必填校验并定位提示；处理深层嵌套组件的状态同步。',
'将扁平组织数据转换为树结构，支持人员单选、多选、全选和已选回显；通过唯一标识去重维护跨页选择结果。',
'使用 vue-pdf 按需挂载和渲染文档页面，配合滚动加载及骨架屏，减少同时渲染大体积附件对移动端内存和主线程的压力。',
'开发文件移动与分享交互，结合接口权限处理不同存储空间的访问展示；在 Axios 层标识并取消重复请求，减少高频操作产生的冗余调用。',
'通过 postcss-px-to-viewport 进行视口换算，并适配安全区；处理政务微信、企业微信及定制 WebView 中的页面展示。'])
project('财政资金填报平台（保密项目）  |  前端工程师','面向政企单位资金管理人员，支持专项资金、部门预算等数据的月度填报、校验、汇总及可视化监测。','Vue 3、Vuex、Vue Router、Element Plus、ECharts、Axios',[
'结合后端模板配置生成填报字段和表格列，绑定校验规则，支持不同资金模板的字段映射与数据回显。',
'实现下达、使用、支出及使用率等指标的联动校验，在提交节点按业务规则限制编辑，减少异常数值录入。',
'实现上月数据回显与当前表单重置，复用历史信息；开发统计表格动态行合并、多模板文件导出及资金数据对比大屏。'])
project('政企微信小程序（保密项目）  |  前端工程师','面向政企移动业务，提供资料访问、地区筛选及扫码核销等功能。','微信小程序原生开发、WXML、WXSS、TypeScript、CryptoJS、Turf.js',[
'基于自定义组件机制封装文件卡片和审批流节点，通过属性与插槽复用展示逻辑，完成移动端页面及安全区适配。',
'对接定位 API 与地理分析工具，实现地区筛选和关联业务数据展示；参与接口加解密、验签及权限相关交互。',
'实现扫码解析、核销反馈和归档交互，使用提交状态锁及防抖减少重复触发，并按需加载附件内容。'])
section('其他交付经历')
p('政企在线文档系统：基于 SpreadJS 开发 Excel 在线预览、角色对应的编辑交互限制和打印对接；封装可配置文字、颜色与位置的水印，处理浏览器兼容问题。数字资料库：参与文档元数据配置、历史数据回显、组织人员选择及数据看板开发。')
section('教育背景')
p('南昌大学  |  计算机科学与技术  |  本科  |  2021.09 - 2023.06')
p('江西现代职业技术学院  |  电子信息工程（物联网）  |  大专')
def footer(c,d):
 c.setStrokeColor(HexColor('#DCE4EB'));c.line(39,37,556,37)
 c.setFont('CN',8);c.setFillColor(HexColor('#728091'));c.drawString(39,24,'魏志峰  |  前端工程师');c.drawRightString(556,24,str(d.page))
doc=SimpleDocTemplate(OUT,pagesize=(595.276,841.89),rightMargin=39,leftMargin=39,topMargin=30,bottomMargin=47)
doc.build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(OUT)
print('Output:',OUT,'Pages:',len(r.pages))
for i,page in enumerate(r.pages): print('Page',i+1,'text chars:',len(page.extract_text()))
