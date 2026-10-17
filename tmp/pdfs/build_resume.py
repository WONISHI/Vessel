from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from pypdf import PdfReader
pdfmetrics.registerFont(TTFont('CN','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
OUT='output/pdf/魏志峰-中级前端工程师-优化简历.pdf'
styles={
'name':ParagraphStyle('name',fontName='CN',fontSize=25,leading=32,textColor=HexColor('#152A43'),spaceAfter=6),
'contact':ParagraphStyle('contact',fontName='CN',fontSize=10,leading=17,textColor=HexColor('#506174'),spaceAfter=9),
'section':ParagraphStyle('section',fontName='CN',fontSize=13,leading=20,textColor=HexColor('#175B87'),spaceBefore=12,spaceAfter=7),
'title':ParagraphStyle('title',fontName='CN',fontSize=11,leading=17,textColor=HexColor('#152A43'),spaceBefore=6,spaceAfter=3),
'body':ParagraphStyle('body',fontName='CN',fontSize=9.5,leading=15.5,textColor=HexColor('#263444'),spaceAfter=5,wordWrap='CJK'),
'meta':ParagraphStyle('meta',fontName='CN',fontSize=8.5,leading=14,textColor=HexColor('#617183'),spaceAfter=5,wordWrap='CJK'),
'bullet':ParagraphStyle('bullet',fontName='CN',fontSize=9.5,leading=15.5,textColor=HexColor('#263444'),leftIndent=10,firstLineIndent=-9,spaceAfter=5,wordWrap='CJK')}
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
p('以 Vue 2 / Vue 3 为主要技术栈，具备政企协同办公、内容管理及移动端 H5 开发经验。参与需求评审、模块开发、接口联调、测试修复和上线跟进；在动态表单、组织树选择、文档预览、权限路由及业务组件复用方面具有项目实践。')
section('专业技能')
bullets([
'Vue 开发：使用 Vue 2 / Vue 3、Vue Router、Vuex / Pinia 完成业务开发，通过 Composition API 抽离公共逻辑并封装业务组件。',
'页面与移动端：使用 HTML、CSS、Sass / Less 及 Flex / Grid 实现页面布局；具备 Vant、视口适配、安全区处理和微信小程序开发经验。',
'复杂业务：具备动态表单校验、组织树级联选择、PDF 文档预览、可视化图表及批量文件导出等开发经验。',
'调试与工程：使用浏览器开发者工具排查渲染、网络与内存问题；实践过资源按需加载、列表可视区渲染和 Vite / Webpack 构建配置；使用 Git 进行版本协作。'])
section('工作经历')
p('南方报业传媒集团  |  前端工程师  |  2024.06 - 2026.05','title')
bullets(['参与内容管理、活动资源平台和竞赛 H5 开发，承担业务模块实现、公共逻辑抽离与组件封装。','参与需求与交互方案评审、接口联调及版本上线，跟进缺陷修复、兼容性问题和线上异常。'])
p('广州市省信软件有限公司  |  前端工程师  |  2019.11 - 2024.04','title')
bullets(['参与政企 OA、会议管理、财政填报、移动网盘和微信小程序等项目，开发表单、组织树、文档预览及数据展示模块。','沉淀公共组件与技术文档，配合产品、设计、后端和测试完成需求迭代及上线交付。'])
section('代表项目')
project('CMS 内容分发系统  |  前端工程师','面向内容运营人员的中后台系统，支持栏目、账号名单及内容分发管理。','Vue 3、Pinia、Vue Router、Wujie、Ant Design Vue',[
'参与 Wujie 微前端重构，完成菜单、动态路由及登录态同步相关开发，管理跨应用响应式副作用的创建与清理。',
'将栏目管理等业务逻辑抽离为组合式函数，利用插槽与双向绑定封装业务组件，减少页面间的重复实现。',
'针对大规模名单页面卡顿，实现可视区动态渲染，结合 shallowRef 减少不必要的深层响应式处理；通过路由懒加载与组件按需引入调整资源加载方式。'])
story.append(PageBreak())
p('魏志峰  /  代表项目与教育背景','contact')
project('百千万工程大数据云图平台  |  前端工程师','面向业务部门的活动资源管理与可视化平台，支持信息采集、资源管理和数据展示。','Vue 3、Pinia、Vue Router、Ant Design Vue、AntV、Vite',[
'基于角色配置过滤菜单并动态注册路由，实现不同职能部门的前端功能访问控制。',
'分离动态表单的字段配置与校验规则，利用 provide / inject 共享表单上下文，处理嵌套组件间的校验状态同步。',
'封装媒体可见性检测逻辑，通过 Intersection Observer 延迟加载图片和视频封面，并使用 AbortController 取消不再需要的请求，减少非可视区域的加载开销。',
'对接 AntV 图表，使用 markRaw 避免图表实例被响应式代理，支持业务数据更新与可视化展示。'])
project('政企会议管理系统  |  前端工程师','面向政企会议组织人员，提供会议排座、桌牌配置、签到码导出及扫码核销功能。','Vue 2、Vuex、vue-draggable-resizable、vuedraggable、JSZip、file-saver',[
'基于拖拽组件开发可视化排座画布，实现元素定位、座位调整与辅助对齐，支持会议排座配置。',
'开发多图层桌牌样式编辑功能，处理浏览器打印中的背景色与布局问题；实现签到码批量生成及 ZIP 导出，将逐个下载整合为批量操作。',
'封装部门与人员级联选择组件，支持递归勾选、已选项回显和不同数据源接入；实现复杂表单的动态校验与错误提示。'])
project('竞赛平台 H5 端  |  前端工程师','面向竞赛参与用户的移动端入口，承载登录、身份校验及竞赛互动相关流程。','Vue 2、Vuex、Vue Router、Vant、阿里云验证码',[
'完成阿里云验证码版本迁移，封装通用验证码组件，统一验证触发、中断与结果反馈接口。',
'针对存量业务调用方式，通过 Event Bus 与 Promise 封装衔接业务请求和验证结果，降低业务入口的重复接入成本。',
'按需异步加载验证码脚本，处理加载超时、重试和移动端 WebView 兼容问题。'])
section('其他项目实践')
bullets(['移动 OA / 网盘：开发公文表单、组织通讯录及文件分享模块；使用 vue-pdf 实现 PDF 按页渲染，结合请求去重与安全区适配改善移动端体验。',
'财政填报 / 文档预览：实现配置化字段与联动校验、历史数据回显、统计表格合并及导出；使用 SpreadJS 开发 Excel 在线预览、权限交互、打印及可配置水印。'])
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
