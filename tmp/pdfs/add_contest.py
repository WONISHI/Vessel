from pathlib import Path
import re
out=Path('output/pdf')
items=[
'参与多类型竞赛配置开发，基于 React Hooks 与 Ant Design Form 拆分活动信息、报名设置和规则配置；处理草稿保存、审核提交及数据回显，通过 iframe 消息传递对接 H5 预览。',
'参与配置化报名字段开发，支持短文本、长文本、图片、视频和 PDF 附件的新增、排序、复制及编辑；区分内置字段和自定义字段，并在删除前校验字段是否已被报名数据使用。',
'参与题库管理开发，覆盖单选、多选、判断及填空题，支持图文视频题干、模板导入、批量删除和题目下载任务；处理新增题目的分页定位，并在保存、审核和全选等操作前提示未保存题目。',
'参与评选规则配置，按活动、阶段和场次管理评审数据，支持单轮及多轮评分、总分或分项评分、投票和排名系数配置；处理模式切换后的数据重置与提交前业务校验。',
'参与多媒体内容校对结果展示，将不同竞赛类型的文本、图片和视频结果转换为列表数据，通过报名字段标识关联原始内容，支持文本命中高亮、媒体标记和重新校对。',
'对接视频分片上传流程，基于 Blob.slice、FileReader 和 SparkMD5 处理文件切片及摘要，按序上传后调用服务端合并接口，衔接上传成功与失败回调。',
'参与活动复制功能，按竞赛类型生成可选复制项，支持复用主页、规则和榜单配置，并对接创建人选择与后台复制任务，减少重复配置操作。'
]
section='''## 云竞赛平台管理端（React）

**参与时间：待确认｜角色：前端工程师（参与模块待确认）**

**项目背景：**面向赛事运营人员的竞赛管理后台，覆盖现场竞赛、在线答题及科创竞赛的活动配置、报名审核、题库维护、评选与结果管理。

**技术栈：**React 17、TypeScript、Umi 3、Ant Design 4、MobX、React Hooks、umi-request、SparkMD5。

**项目经历：**

'''+ '\n\n'.join(f'{i+1}. {t}' for i,t in enumerate(items))+'\n\n'
(out/'云竞赛平台管理端-简历项目段落.md').write_text(section)
original=Path('/Users/weizhifeng/Desktop/魏志峰的简历.md').read_text()
anchor='2025.05 - 2026.12'
assert original.count(anchor)==1
(out/'魏志峰的简历-新增竞赛管理端.md').write_text(original.replace(anchor,section+'---\n\n'+anchor))
src=Path('tmp/pdfs/build_full_resume.py').read_text()
src=src.replace('魏志峰-中级前端工程师-完整优化版.pdf','魏志峰-中级前端工程师-新增竞赛管理端.pdf')
insert="\np('魏志峰  /  React 项目经历','contact')\nsection('云竞赛平台管理端')\np('前端工程师  |  React / TypeScript 业务开发','title')\np('面向赛事运营人员的管理后台，覆盖现场竞赛、在线答题及科创竞赛的活动配置、报名审核、题库维护、评选与结果管理。')\np('技术栈：React 17、TypeScript、Umi 3、Ant Design 4、MobX、umi-request、SparkMD5','meta')\n"
for label,text in zip(['多步骤配置与预览','配置化报名字段','多题型题库与编辑状态','评选规则与模式切换','多媒体校对与内容定位','视频分片上传','活动配置复用'],items):
 insert+='p('+repr(label)+",'title')\np("+repr(text)+')\n'
insert+='story.append(PageBreak())\n'
# Add project after the first page, leaving all previous project content intact.
needle="story.append(PageBreak())\np('魏志峰  /  项目经历','contact')"
assert needle in src
src=src.replace(needle,"story.append(PageBreak())\n"+insert+"p('魏志峰  /  项目经历','contact')",1)
src=src.replace('有 React 项目开发及 UniApp 跨端开发经验。','具备 React + TypeScript 竞赛管理端及 UniApp 跨端开发经验。')
Path('tmp/pdfs/build_contest_resume.py').write_text(src)
xml=Path('/Users/weizhifeng/Desktop/global/迁移copy/nf-contest-platform-admin/repomix-output.xml').read_text()
paths=[
('配置化报名字段','src/pages/contest/create/components/SignUpOptionsInput/index.tsx','字段类型、默认项保护、排序复制、删除前业务校验；难点是字段标识与历史报名数据保持一致。'),
('活动编辑和 H5 预览','src/pages/contest/create/index.tsx','多步骤数据合并、草稿/审核分支、上传值转换和 iframe postMessage；可写配置预览，不应声称双向实时同步已完整验证。'),
('题库编辑与分页','src/pages/answer/create/components/QuestionBankManage/index.tsx','新增题目末页定位、未保存列表、当前页全选、导入与下载任务；分页并不等于虚拟列表，代码也没有全流程离页保护。'),
('评选规则','src/pages/contest/selection/components/SourceRules/index.tsx','按阶段/场次提交规则；单轮多轮切换、评分项和投票参数校验。属于规则配置，不能说实现了服务端计分算法。'),
('多媒体校对','src/components/Proofread/hooks/usePlayerProofreadResult.ts','转换不同业务类型及文本/图片/视频结果，归一为展示数据；可写校对服务接入，不写自研识别或审核算法。'),
('命中内容定位','src/components/Proofread/hooks/useProofread.ts','通过 signUpId 关联原文，使用 mark.js 高亮文字并标记媒体字段。'),
('视频上传','src/hooks/useUpload.tsx','1MB 分片、文件/分片摘要、串行上传及服务端合并；未见完整断点续传、自动重试、并发控制与 Web Worker 哈希，且先读全文件，不能宣称低内存上传。'),
('活动复制','src/components/CompetitionDuplicator/index.tsx','按类型与模板生成复制选项，选择创建人、提交后台复制任务；前端并非自行完成全量数据复制。'),
('组织树与分组','src/components/DepartmentSelect/index.tsx','复合标识定位节点、构造部门完整路径与 Map 索引，支持搜索和编辑回显。'),
('证书模板','src/components/Certificate/utlis.ts','占位符替换、按基准宽度缩放、二维码及不同署名布局；可写模板预览，不能由代码直接推导为物理打印完全一致。')]
report='# 云竞赛平台管理端：亮点、难点与简历写法\n\n本分析基于附件代码静态阅读，未运行项目。代码存在不等于全部由候选人实现；个人贡献和参与时间待确认。\n\n## 核心判断\n\n项目最有价值的是 React + TypeScript 复杂中后台实践：多类型活动配置、嵌套业务数据、题库编辑状态、多媒体校对和后台异步任务。建议在简历中与 Vue 2 的竞赛 H5 分开，紧邻排列。\n\n## 代码证据与边界\n\n'
for title,path,desc in paths:
 mark=f'<file path="{path}">';line=xml[:xml.index(mark)].count('\n')+1
 report+=f'### {title}\n\n{desc}\n\n附件证据：`{path}`（repomix-output.xml 第 {line} 行起）。\n\n'
report+='''## 面试重点准备

1. 报名字段为什么同时需要服务端 id、默认字段枚举和前端临时 key？复制和编辑回显时怎样保持身份稳定？
2. 新增题目落在下一页时，分页参数、接口刷新和本地未保存记录怎样衔接？哪些操作已经拦截，哪些边界还没覆盖？
3. 评分模式切换为什么清空 professionalRule？哪些规则只是前端校验，哪些必须由服务端再次校验？
4. 校对结果怎样从后端嵌套结构转成统一列表，再关联回原始字段？视频“处理中、失败、完成”如何展示？
5. 视频分片上传现在的实现有哪些限制？大文件读内存、失败恢复、取消和重试怎样进一步设计？明确区分现有实现与改进设想。
6. 活动复制由前端传递哪些参数，后台负责什么？为何要根据活动类型和模板裁剪复制项？

## 尚待确认

- 实际参与起止月份，以及上述哪些模块由你实现、维护或协作完成。
- 覆盖活动数量、运营使用人数、典型题库条数、视频文件大小等真实业务规模。
- 是否存在可复核的效率或性能对比；目前未写入百分比或吞吐指标。

'''+section
(out/'竞赛管理端-亮点难点分析.md').write_text(report)
print('Markdown deliverables created')
