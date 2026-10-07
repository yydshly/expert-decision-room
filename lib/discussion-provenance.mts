/** App-authored context receipt. It records what was sent, not what is true. */
export type ContextRecord={id:string;role:string;body:string};
export type ContextReceipt={version:1;messages:{id:string;kind:'user-report'|'model-opinion'}[];externalVerification:false};
const marker='\ncontext-receipt:v1:';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const evidenceBoundary='用户陈述是用户提供的信息，未独立核验；模型此前的意见不是事实证据，多位角色重复同一说法不构成交叉验证。明确区分原话、推断和建议，无法确认时直接说明。';
export function contextKind(role:string){return role==='本人'?'user-report' as const:'model-opinion' as const;}
export function captureContext(records:ContextRecord[]):ContextReceipt{
 return {version:1,messages:records.map(r=>({id:r.id,kind:contextKind(r.role)})),externalVerification:false};
}
export function appendContextReceipt(source:string,records:ContextRecord[]){return source+marker+JSON.stringify(captureContext(records));}
export function readContextReceipt(source:string):{technical:string;receipt:ContextReceipt|null}{
 const index=source.indexOf(marker);if(index<0)return {technical:source,receipt:null};
 const technical=source.slice(0,index);
 try{
  const value=JSON.parse(source.slice(index+marker.length));
  if(value.version!==1||value.externalVerification!==false||!Array.isArray(value.messages)||value.messages.length>8)throw new Error('INVALID');
  const seen=new Set<string>();
  for(const m of value.messages){if(!m||typeof m.id!=='string'||!uuid.test(m.id)||!['user-report','model-opinion'].includes(m.kind)||seen.has(m.id.toLowerCase()))throw new Error('INVALID');seen.add(m.id.toLowerCase());}
  return {technical,receipt:{version:1,externalVerification:false,messages:value.messages.map((m:{id:string;kind:'user-report'|'model-opinion'})=>({id:m.id,kind:m.kind}))}};
 }catch{return {technical,receipt:null};}
}
