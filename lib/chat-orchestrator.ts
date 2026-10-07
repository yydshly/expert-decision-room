/** Server-only execution seam. No provider is connected or invoked by public routes. */
import {appendRecord, readWorkspace} from './workspace';
import {getRole} from './role-store';
import {type RoleId} from './role-config';
export const experts=[
 {id:'research',name:'需求与资讯研究员',focus:'原始消息、用户问题、替代解释'},
 {id:'product',name:'产品负责人',focus:'发散方向、体验假设、产品取舍'},
 {id:'architecture',name:'AI / 架构专家',focus:'新能力、系统设计、低成本实验'},
 {id:'growth',name:'增长编辑',focus:'实际成果、叙事角度、个人 IP'},
 {id:'skeptic',name:'商业质疑者',focus:'反例、机会成本、停止条件'}
] as const;
export type ChatIntent='explore'|'interrupt'|'summarize';
/** Scheduler supplies evidence/context, not a decision or forced consensus.
 * Future provider integration must check latest user interruption before each dispatch,
 * record actual provider provenance, cap per-request calls/cost, and stop on cancellation.
 * Exploration is the default; synthesis is only scheduled for an explicit user request.
 */
export function planTurn(intent:ChatIntent){return {intent,mode:intent==='summarize'?'user_requested_synthesis':'divergent',maximumRounds:2,maximumProviderCalls:5,stopOnUserInterruption:true,autoConsensus:false,roles:intent==='summarize'?['product']:['research','architecture','product','skeptic','growth'],providerConnected:false as const};}
export async function queueUserMessage(owner:string,input:{id:string;text:string;intent:ChatIntent}){
 const text=input.text.trim();if(!text||text.length>16000)throw new Error('INVALID_MESSAGE');
 const plan=planTurn(input.intent);
 const workspace=await appendRecord(owner,{id:input.id,kind:input.intent==='interrupt'?'constraint':'session',title:text.slice(0,120),body:text,source:`chat:v1:pending:${input.intent}`,role:'本人'});
 return {...workspace,messageStatus:'saved_waiting_for_model',plan};
}
export async function loadChatContext(owner:string){return {workspace:await readWorkspace(owner),experts,defaultMode:'divergent',requireUserRequestToSummarize:true};}
/** Future explicit opt-in execution entry point; deliberately not wired to an HTTP route.
 * The caller must supply an authorized provider and account-level cost/rate controls.
 * Each actual contribution receives the growing shared transcript; there are no scripted replies.
 */
export async function executeDiscussion(input:{owner:string;triggerId:string;intent:ChatIntent;signal:AbortSignal;provider:(turn:{role:string;round:number;context:unknown;signal:AbortSignal})=>Promise<{text:string;model:string;responseId:string}>}){
 const plan=planTurn(input.intent);let completed=0;
 for(const roleId of plan.roles){
  if(input.signal.aborted)return {status:'interrupted',completed};
  const context=await readWorkspace(input.owner);
  const newestUser=context.records.find((r:any)=>r.role==='本人'&&String(r.source).startsWith('chat:v1:')) as any;
  if(!newestUser||newestUser.id!==input.triggerId)return {status:'superseded_by_user',completed};
  const profile=await getRole(input.owner,roleId as RoleId);
  const response=await input.provider({role:roleId,round:1,context:{...context,approvedRoleConfig:profile.approved,roleConfigVersion:profile.version,verification:profile.verification},signal:input.signal});
  if(input.signal.aborted)return {status:'interrupted',completed};
  const latest=await readWorkspace(input.owner);
  const latestUser=latest.records.find((r:any)=>r.role==='本人'&&String(r.source).startsWith('chat:v1:')) as any;
  if(latestUser?.id!==input.triggerId)return {status:'superseded_by_user',completed};
  const expert=experts.find(r=>r.id===roleId)!;
  await appendRecord(input.owner,{id:crypto.randomUUID(),kind:'expert',title:`${expert.name}的发言`,body:response.text,source:`实际模型运行：${response.model}；响应：${response.responseId}；关联消息：${input.triggerId}；角色配置版本：${profile.version}；能力验证：${profile.verification}`,role:expert.name});
  completed++;
 }
 return {status:'completed',completed,mode:plan.mode};
}
