# 共想室

私人中文专家群聊。当前版支持用户主动发送触发一轮国内 MiniMax 讨论、停止、插话和错误展示；不会后台自动循环。下方早期设计记录保留用于溯源，当前行为以文末“当前可试用流程”为准。

## 已实现
- 固定五位专家成员与用户、共享消息流、单一消息输入框
- 明确标记的示例对话（不写入数据库，不是实际专家执行）
- 真实用户发言持久保存并显示等待模型状态；不伪造回答
- 自由发散默认，用户主动要求收敛或中断才记录对应意图
- 次级群资料页承载证据、决定及讨论规则；原有记录全部保留
- D1 按平台认证用户隔离，UUID 幂等写入；最近300条可读，旧记录不删除
- POST /api/chat 接受 {id:UUID,text:string,intent:'explore'|'interrupt'|'summarize'}
- GET/POST /api/workspace 与 MCP 共用记录和验证
- 私人 MCP /mcp：read_decision_workspace、append_decision_record；同名浏览器 WebMCP

## 未连接的真实执行结构
lib/chat-orchestrator.ts 的 queueUserMessage 只持久保存用户消息并返回待模型状态。
executeDiscussion 是未挂HTTP路由的未来执行入口：注入真实 provider；逐位获取共享上下文；每次调用前和写入前检查用户打断；仅保存真实 provider 返回与溯源；默认发散，只在用户明确要求时安排汇总。它不会自我调用或决定内容。
lib/openai-adapter.ts 是未来服务端 OpenAI Responses API 适配器，当前未接通，无真实调用。

未来需用户授权配置服务端凭据、模型及费用/速率限制，再挂载真实执行。配置密钥本身不会自动启用执行。禁止在浏览器或聊天中收集密钥。

## MCP
- read_decision_workspace({}) → {records,aiExecution:'not_connected',historyLimit:300}
- append_decision_record({id,kind,title,body,source?,role?}) → 同上
- kind: session/evidence/expert/objection/decision/task/feedback/constraint
- id UUID；title 1–160；body 1–16000；source ≤2000；role ≤100
- 数据操作要求平台认证用户ID。工具发现不含私人数据。Site保持 owner-private。

当前没有联网研究、定时更新、外部发布或自动专家执行。

## 成员能力档案

点击群成员打开档案。职责/边界与领域资料、步骤、工具依赖、评测用例、失败教训分开。所有技能仍为未验证；确认配置不等于验证能力，讨论记录不等于权重训练。

角色资料通过 D1 role_proposals 和 role_versions 追加保存，不修改原 records。GET /api/roles?role=research 读取已批准版本、待审草案与历史。POST /api/roles 支持 propose（草案）及用户界面明确选择的 accept/reject。采用操作事务化，以基准版本检查并发，陈旧草案不能覆盖新版本。同草案重复采用不重复增版。

需求研究员包含唯一具体候选技能示例：来源→任务→替代方案→强度→未知，附评分草案和明确虚构的评测/失败示例，没有伪造真实来源或通过记录。其他角色没有虚构的成熟技能。

未来 executeDiscussion 读取已批准配置的确切版本；pending 草案不参与执行。当前仍未接通任何 provider 或实际评测。

## 有限任务协作实验

群聊顶部“协作实验”打开次级实验界面，不替代自由讨论。范围限定为一条 AI 能力更新→事实核验笔记＋小实验设计，不是 ASI 或通用能力验证。

预先保存相同输入、模型/工具范围要求和每组相同总预算，以及正确性、可核验证据、任务完成度、时间、调用成本评分规则。计划不可覆盖修改，避免看到结果后改规则。实际执行未连接；预算不构成付费调用授权。

experiments/experiment_entries 两表存计划与追加记录，原聊天和成员配置不变。POST /api/experiments 的 create 冻结计划；record 保存 result/verification/feedback 人工记录。真实结果必须有来源与反例/局限说明，指标缺失保留 null，不捏造零成本或分数。人工核验说明的独立性未自动确认，所有记录保持未核验，不计算赢家或自动能力提升。

反馈可进入现有成员改进审核，必须另行明确采用草案。没有自动改配置或权重训练。

## MiniMax 接入准备（未启用）

- `lib/provider-adapter.ts` 可选择 OpenAI / MiniMax，不自动回退到另一家，避免意外计费或跨供应商发送资料
- `lib/minimax-adapter.mts` 只允许核验过的国内/国际官方接口；流式消费并记录实际 usage、首个正文耗时、总耗时、模型与响应 ID；忽略 reasoning 内容；只有完整成功正文才可交付或持久化
- 90 秒上限、输出上限、上下文上限、取消、拒绝重定向；HTTP 错误不回传账号细节；缺失 usage 保持 null，不声称零成本
- `lib/execution-budget.mts` 为单轮保守预留预算，失败调用也占用预算；价格必须按用户账户与当前价目核验后配置。它不是跨请求/跨实例限额
- 公开 HTTP 路由仍然只保存用户消息，绝不调用模型。接入层没有服务端密钥，设置密钥也不会自动启用
- 实际启用前仍必须完成：安全用户输入、持久访问行动时授权、区域/Key 类型核验、明确总费用上限、D1 原子预算预留/幂等任务锁、账号级限额与停止入口；不得把进程内预算当成生产总预算
- 已有编排每个角色执行前、完成后检查新用户消息；角色配置版本追加到真实输出溯源。取消后已提交供应商的调用可能仍计费
- 测试：`node --experimental-strip-types --test tests/minimax-adapter.test.mjs`，仅模拟，无真实接口费用

### 首轮对比计划（待用户预算与凭据授权，不是实测结果）

同一份固定证据、同一模型与参数、同一总上限；共 6 次调用，无重试、无搜索、无自动循环。
单角色组：同一个通才连续三步（初稿、自我质疑、修订）。多角色组：研究员→技术评审→质疑者，共三步，后者读取已有观点。每组允许相同三次调用、总输入字节上限与总输出上限，不把五人热闹程度当质量。
每次最多 8,000 UTF-8 输入字节、4,096 输出 token（包括思考）；每组最多 24,000 输入字节和 12,288 输出 token。超限停止，不静默截掉证据。国际账户建议总上限 US$0.15；国内账户建议总上限 ¥1，最终以用户明确批准及已核验的当前计费为准。
只用非敏感、固定给定公开资料；不自动发送用户历史群聊。记录实际输出、引用正确率、关键错误、反例覆盖、是否具体接话、首字/总耗时、调用数、token usage 和账单依据。使用现有评分规则，由独立人工核验；没有检验就不宣布赢家。首次结果只能描述这一输入，不能推断普遍专业能力。

### 国内 Token Plan（2026-10-07 用户确认）

实际接入目标限定国内订阅 Key，不改国际、不改按量 Key。官方 Token Plan 说明允许自己的 OpenAI 兼容工具及个人交互使用；M Plan「其他工具」也列出 Open WebUI、Dify、LangChain。当前老 Token Plan 文档列出 MiniMax-M3.1-Flash-Preview；适配器对该模型显式使用 low 思考深度，避免默认 max。最终模型以账户可用项为准，不自动替换。

安全自填：用户在 https://chatgpt.com/sites 找到本站，More actions → Settings，将国内订阅 Key 作为 MINIMAX_API_KEY secret 保存。用户自己输入，不放聊天、附件、源码或工具参数。确认配置并重新部署不等于授权自动调用。

官方费用说明：订阅 Key 不扣普通按量账户余额，但套餐内额度耗尽后会自动使用已有积分包；这不是“保证免费”。未核实套餐剩余额度及避免积分超额的方法前保持执行禁用。不充值、不升级、不改续费设置、不降级为普通按量密钥。参考 https://platform.minimax.cn/docs/m-plan/faq 、https://platform.minimax.cn/docs/m-plan/token-plan-notice 、https://platform.minimax.cn/docs/m-plan/other-tools 。

D1 准备：execution_grants / execution_calls 为新增表，不修改原聊天、角色或实验数据。独占 owner 任务锁；原子预留并记录调用；每个有限授权最多 6 次、每组 3 次，输入/输出总额相同；10 秒间隔；拒绝跨用户、过期、重放、已停止任务。失败与取消不返还预算。没有自动建授权、重置额度、超时释放重跑或公开执行端点。真实启用还必须加入凭据类型验证、套餐额度前置核验及断流/用户插话时取消调度，端到端测试通过后才可启用。

### 本次用户授权的有限真实测试
用户确认国内 Token Plan 有额度并要求直接测试，不再要求截图或查余量。一次性授权标识 `user-confirmed-token-plan-2026-10-07-0245`：最多6次、每次2048 completion token、90秒超时、无重试，使用非敏感虚构笔记产品资料。单角色三步与三角色三步有相同调用和token上限；第一步兼作连通性测试，失败立即停止。套餐额度依据标记为用户确认而非 API 已验证。不充值、不升级、不用普通按量 Key、不换地区；不承诺无法从供应商侧强制执行的人民币硬上限。
`POST /api/model-evaluation?action=run` 为 owner-private 平台保护的一次性服务诊断；同一固定授权重复请求不可重置，完成/失败均终止，`action=stop` 可停止后续调用。结果与失败保存在 execution_calls，非私人群聊历史。此路由不接受自定义提示词、不启动无限群聊、不自动改变角色能力配置。公开群聊发消息仍仅保存。

运行时修正：第一次预留在 fetch 发出前遇到 Cloudflare 不支持 redirect:error，记录耗时0ms，未收到模型响应。改用 manual 并拒绝3xx；保留该失败预留及原授权。仅对此确切错误允许一次恢复，其余错误停止。剩余最多5次（单角色2、多角色3），结果明确 budgetMatched:false，因此本轮只做连通性与输出观察，不能据此宣布协作优于单角色。

### 真实测试结果（2026-10-07）
5次 MiniMax-M3.1-Flash-Preview 国内订阅调用全部成功，输入2454、输出1116、总3570 tokens；首正文1.767–3.015秒，完整3.533–5.085秒。另有1次本地 fetch 参数错误占用预留，0ms即失败；保留审计且未退还预留。任务最终 completed，总预留6。费用未从账单独立核验，不把套餐使用写成零成本。
角色能具体回应先前观点（质疑付费条件与检索实验混杂、4人愿试用不等于5人均参与）；但阈值3/4或4/5缺少依据，“两天不能验证付费”过于绝对，且原始150条反馈不是150名用户。测试仅能建立连通性及这一虚构任务的输出观察，不能证明角色专业资质或普遍多智能体优势。非匹配预算对照，不宣布赢家。

## 当前可试用流程

登录私有站，点击架构取舍 / 岗位与学习 / 海底场景教学任一虚构场景，仅填入草稿。确认后点击“发送给 MiniMax”启动一轮。每轮由研究、架构、质疑三位接话；产品/增长档案保留，明确要求收敛时由产品角色整理。用户的新消息与停止优先，未完成旧回复不会作为新观点追加。错误保留显示，已完成发言保留。不自动循环、不充值、不切换按量 Key。

发送会将当前问题、有限近期聊天、已采用角色资料传给国内 MiniMax。勿提交不愿交给该服务的私人资料；没有外部搜索或资料核验。输入受每调用8,000字节、2048输出token、90秒限制；旧上下文会按预算缩减，当前问题完整保留，超长则报错。角色配置版本、模型响应ID、真实usage和耗时随发言保存。

私有 `/trial` 页面展示真实试跑、失败与局限；`docs/evaluations/` 为可检查的非敏感合成评测记录。测试：`npm test`，`npx tsc --noEmit`。`npm run test:browser` 需要 Chromium 和本地4784端口预览，仅使用模拟API，不读取密钥、不调用模型。云端本地浏览器受socket限制；已由公开仓库标准runner完成受控模拟UI验证，见下方记录。

GitHub导出不包含 .openai/hosting.json、.git、.env、node_modules、.wrangler、数据库、用户会话或任何API密钥。使用现有私有Site作为实际服务，不要通过GitHub Pages部署含服务端功能的项目。Node24；`npm ci`；`npm run dev`；本地无MiniMax机密时只有模拟测试可运行。生产必须使用支持Cloudflare Worker/D1和平台身份的受保护环境，不能自行信任客户端传入的用户身份头。

干净GitHub克隆需先建立不含托管身份的本地清单：`mkdir -p .openai && cp config/hosting.local.example.json .openai/hosting.json`，再 `npm ci` / `npm run dev`。不要把实际Site的project_id、机密或数据库复制进GitHub。CI使用相同的匿名本地模板。

## 可读性修正
此前提示词要求“引用消息ID”，且UI把Markdown与运行溯源字符串原样展开，导致技术编号干扰阅读。现在提示词要求自然接话；发给模型的上下文用说话者与可读摘录，不包含内部触发ID。已有历史不重写：显示层将确切已知引用变为可点击消息名称，未知引用标为当前不可用，代码中的标识保留。Markdown安全渲染，不执行HTML；运行ID、usage等默认折叠。测试全部使用虚构纸飞机消息，不把真实私人对话放进GitHub或CI截图。浏览器CI保持Chromium sandbox，Ubuntu22.04运行。

## GitHub 源码归档

本源码仓库已按作者授权公开，归档来源版本 `0307d17ecd50b46dcc9527e7b2bd0649d636b428`。试用入口：https://expert-decision-room.yydshly.chatgpt.site/ （需本人登录）。不包含生产身份配置、密钥、数据库或用户聊天。评测题目与浏览器 fixture 均为合成数据。

GitHub 工作流仅手动触发，首次提交不会自动运行。本次公开源码未启用自动运行；任何新增运行应先确认适用的额度与范围。浏览器测试使用模拟 API，不代表真实 MiniMax 全流程已通过。真实 Chromium 桌面与390px截图回归已完成，全部使用虚构消息。

## 2026-10-07 浏览器回归

[验收记录与截图](docs/ui-verification-2026-10-07/verification.json)，[实际运行](https://github.com/yydshly/expert-decision-room/actions/runs/37574007605)。27项逻辑测试、类型检查和14项模拟UI检查通过；覆盖引用可读化、停止/插话/错误恢复、底部跟随与读旧消息保护、390px布局。0模型调用、0外部浏览器请求、0pageErrors。

`citation-bug-synthetic-before.png` 是虚构消息的旧渲染模拟，不是私人生产截图。测试提交`bdd2a28fb63b42ab8af1f683b53a929042b1a345`；对应业务UI来源`1ede70d5a3ae60548303eb8a4b975fba7ac349ed`。这不等于新验证了真实MiniMax模型调用链。
