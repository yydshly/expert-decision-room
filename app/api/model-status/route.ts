import {env} from 'cloudflare:workers';
/** Read-only provider quota inspection. Never invokes a completion or reveals a secret. */
function numericQuota(value:unknown,depth=0):unknown{
 if(depth>8)return null;
 if(typeof value==='number'||typeof value==='boolean'||value===null)return value;
 if(Array.isArray(value))return value.slice(0,100).map(v=>numericQuota(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/(api.?key|secret|authorization|access.?token|user.?id|group.?id|email|phone)/i.test(k)).slice(0,100).map(([k,v])=>[k,typeof v==='string'?(/^(model|model_name|unit|status|type|plan_name)$/.test(k)?v.slice(0,100):'[omitted]'):numericQuota(v,depth+1)]));
 return null;
}
export async function GET(request:Request){
 // This owner-private Site's platform access boundary authenticates browser and service callers.
 // No user-owned records or connected apps are read. Remove this shared diagnostic if the audience expands.
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'INVALID_ORIGIN'},{status:403});
 const configuration=env as unknown as Record<string,string|undefined>;
 const key=configuration.MINIMAX_API_KEY;
 if(!key)return Response.json({configured:false,executionEnabled:false,reason:'SECRET_NOT_CONFIGURED'},{headers:{'Cache-Control':'no-store'}});
 if(!key.startsWith('sk-cp-'))return Response.json({configured:true,executionEnabled:false,reason:'SUBSCRIPTION_KEY_TYPE_NOT_CONFIRMED'},{headers:{'Cache-Control':'no-store'}});
 const base=configuration.MINIMAX_API_BASE?.replace(/\/$/,'');
 if(base&&!['https://api.minimax.cn','https://api.minimax.cn/v1'].includes(base))return Response.json({configured:true,executionEnabled:false,reason:'DOMESTIC_ENDPOINT_REQUIRED'},{headers:{'Cache-Control':'no-store'}});
 try{
  const r=await fetch('https://www.minimax.cn/v1/token_plan/remains',{headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return Response.json({configured:true,executionEnabled:false,quotaStatus:r.status,reason:'QUOTA_CHECK_FAILED'},{headers:{'Cache-Control':'no-store'}});
  const data=await r.json();return Response.json({configured:true,executionEnabled:false,provider:'minimax',region:'cn',endpoint:'https://api.minimax.cn/v1',quota:numericQuota(data),billingGuard:'No inference permitted until included quota and overage protection are verified.'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const category=error instanceof Error&&['TimeoutError','AbortError','SyntaxError','TypeError'].includes(error.name)?error.name:'UnknownError';return Response.json({configured:true,executionEnabled:false,reason:'QUOTA_CHECK_UNAVAILABLE',category},{headers:{'Cache-Control':'no-store'}});}
}
