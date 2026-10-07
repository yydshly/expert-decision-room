'use client';
import {readContextReceipt} from '@/lib/discussion-provenance.mjs';
import {referenceLabel,type MessageReference} from '@/lib/message-presentation.mjs';
export function DiscussionContext({source,records}:{source:string;records:MessageReference[]}){
 const {technical,receipt}=readContextReceipt(source);
 const byId=new Map(records.map(r=>[r.id.toLowerCase(),r]));
 return <div className="discussionContext">
  <span className="evidenceBoundary">AI 观点 · 未联网核验</span>
  <details className="contextReceipt"><summary>本次参考的对话{receipt?`（${receipt.messages.length}条）`:''}</summary>
   <p>这里列出模型实际收到的对话，不表示每句话都被引用或已核实。多个角色重复同一说法，也不算独立证据。</p>
   {receipt?<ul>{receipt.messages.map(m=>{const record=byId.get(m.id.toLowerCase());return <li key={m.id}><span className="contextKind">{m.kind==='user-report'?'你提供的信息':'AI 的此前观点'}</span>{record?<a href={`#message-${record.id}`}>{referenceLabel(record)}</a>:<span>原消息不在当前加载的记录中</span>}</li>;})}</ul>:<p>这条回复没有可读取的上下文清单，无法补推它当时看过哪些消息。</p>}
  </details>
  <details className="messageTechnical"><summary>查看依据与运行详情</summary><p>模型调用记录，不等于外部事实核验。</p><div>{technical}</div></details>
 </div>;
}
