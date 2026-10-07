/** Server-only. Deliberately not imported by a public route until secure setup and budget approval. */
export type Region = 'cn' | 'international';
export type Usage = {inputTokens:number;outputTokens:number;totalTokens:number};
export type MiniMaxInput = {apiKey:string;region:Region;model:string;system:string;context:string;maxCompletionTokens:number;signal:AbortSignal;onText?:(text:string)=>void};
export const endpoints = {cn:'https://api.minimax.cn/v1/chat/completions',international:'https://api.minimax.io/v1/chat/completions'} as const;
const models = new Set(['MiniMax-M3.1-Flash-Preview','MiniMax-M3','MiniMax-M2.7','MiniMax-M2.7-highspeed','MiniMax-M2.5','MiniMax-M2.5-highspeed','MiniMax-M2.1','MiniMax-M2.1-highspeed','MiniMax-M2']);
export function parseUsage(value:unknown):Usage|null {
 const u=value as Record<string,unknown>|null;
 if(!u || !['prompt_tokens','completion_tokens','total_tokens'].every(k=>Number.isSafeInteger(u[k]) && (u[k] as number)>=0))return null;
 return {inputTokens:u.prompt_tokens as number,outputTokens:u.completion_tokens as number,totalTokens:u.total_tokens as number};
}
export async function runMiniMax(input:MiniMaxInput,fetcher:typeof fetch=fetch){
 if(!input.apiKey || !endpoints[input.region] || !models.has(input.model))throw new Error('MODEL_NOT_CONFIGURED');
 if(!Number.isInteger(input.maxCompletionTokens)||input.maxCompletionTokens<1||input.maxCompletionTokens>8192)throw new Error('OUTPUT_LIMIT');
 if(new TextEncoder().encode(input.system+input.context).length>24000)throw new Error('CONTEXT_LIMIT');
 input.signal.throwIfAborted();
 const started=Date.now();let firstTokenMs:number|null=null;
 const signal=AbortSignal.any([input.signal,AbortSignal.timeout(90000)]);
 const response=await fetcher(endpoints[input.region],{method:'POST',redirect:'manual',signal,headers:{Authorization:`Bearer ${input.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:input.model,messages:[{role:'system',content:input.system},{role:'user',content:input.context}],stream:true,stream_options:{include_usage:true},reasoning_split:true,max_completion_tokens:input.maxCompletionTokens,temperature:1,service_tier:'standard',...(input.model==='MiniMax-M3.1-Flash-Preview'?{reasoning_effort:'low'}:{})})});
 // Never relay provider error bodies (they may contain account details).
 if(!response.ok)throw new Error(`MINIMAX_HTTP_${response.status}`);
 if(!response.body)throw new Error('EMPTY_STREAM');
 const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='',text='',responseId='',model=input.model,done=false,finishReason:string|null=null,usage:Usage|null=null,bytes=0;
 function frame(frameText:string){
  const data=frameText.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
  if(!data)return;if(data==='[DONE]'){done=true;return;}
  const event=JSON.parse(data);
  if(event.error || (event.base_resp?.status_code && event.base_resp.status_code!==0))throw new Error('MINIMAX_PROVIDER_ERROR');
  if(typeof event.id==='string')responseId=event.id;
  if(typeof event.model==='string')model=event.model;
  if(event.usage)usage=parseUsage(event.usage);
  const choice=event.choices?.[0];if(choice?.finish_reason)finishReason=choice.finish_reason;
  const part=choice?.delta?.content;
  if(typeof part==='string'&&part){
   // reasoning_split is required. Fail closed if a provider ignores it; do not display reasoning.
   text+=part;if(text.includes('<think>')||text.includes('</think>'))throw new Error('UNEXPECTED_REASONING_FORMAT');
   if(firstTokenMs===null)firstTokenMs=Date.now()-started;
  }
 }
 try{
  while(!done){signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>1_000_000)throw new Error('STREAM_LIMIT');buffer+=decoder.decode(chunk.value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let index;
   while((index=buffer.indexOf('\n\n'))>=0){frame(buffer.slice(0,index));buffer=buffer.slice(index+2);}
  }
  if(buffer.trim()&&!done)frame(buffer);
  if(!done||!finishReason)throw new Error('INCOMPLETE_STREAM');
  if(finishReason!=='stop')throw new Error(`MINIMAX_FINISH_${finishReason}`);
  if(!text.trim()||!responseId)throw new Error('EMPTY_MODEL_RESPONSE');
  signal.throwIfAborted();
  // Deliver only validated visible output; raw reasoning is never persisted or shown.
  input.onText?.(text);
  return {text,model,responseId,usage:usage as Usage|null,firstTokenMs,elapsedMs:Date.now()-started,finishReason,provenance:'minimax_chat_completions'};
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
