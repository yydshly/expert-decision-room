export type MessageReference={id:string;role:string;title?:string;body:string};
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const escapeLabel=(s:string)=>s.replace(/[\\[\]()*_`<>]/g,'').replace(/\s+/g,' ').slice(0,34);
export function referenceLabel(record:MessageReference){if(record.role!=='本人')return `${record.role}的发言`;const value=record.title||record.body;const excerpt=escapeLabel(value);return `你：${excerpt}${value.length>34?'…':''}`;}
/** Resolve exact known IDs, not arbitrary identifiers. Never mutate persisted text. */
export function readableMessage(text:string,records:MessageReference[],links=true){
 const byId=new Map(records.map(r=>[r.id.toLowerCase(),r]));const missing=new Set<string>();
 const display=text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,index)=>{
  if(index%2)return part; // Preserve code examples and literal identifiers.
  let value=part.replace(/^[ \t]*\*\*给定事实（引用消息ID）\*\*[ \t]*$/gm,'**讨论依据**');
  value=value.replace(new RegExp(`\\[?(${uuid})\\]?`,'gi'),(full,id:string,offset:number,whole:string)=>{
   const record=byId.get(id.toLowerCase());
   if(record){const label=referenceLabel(record);return links?`[${label}](#message-${record.id})`:label;}
   const before=whole.slice(Math.max(0,offset-30),offset);const after=whole.slice(offset+full.length,offset+full.length+5);
   const referenceLike=/引用|消息ID|消息编号/.test(before)||/(^|\n)\s*[-*]?\s*$/.test(before)&&/^\s*[:：]/.test(after)||full.startsWith('[');
   if(referenceLike){missing.add(id);return '（引用消息暂不可用）';}return full;
  });return value;
 }).join('');
 return {text:display,missingReferences:[...missing]};
}
