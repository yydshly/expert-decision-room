import test from 'node:test';
import assert from 'node:assert/strict';
import {runMiniMax,parseUsage} from '../lib/minimax-adapter.mts';
import {ExecutionBudget} from '../lib/execution-budget.mts';
const input=()=>({apiKey:'test-placeholder',region:'cn',model:'MiniMax-M2.7',system:'Test',context:'Question',maxCompletionTokens:1024,signal:new AbortController().signal});
const event=x=>`data: ${JSON.stringify(x)}\n\n`;
const success=event({id:'test-response',model:'MiniMax-M2.7',choices:[{delta:{reasoning_content:'never display',content:'结论'},finish_reason:null}]})+event({choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:20,total_tokens:32}})+'data: [DONE]\n\n';
function fake(body=success,status=200){return async(url,options)=>{assert.equal(url,'https://api.minimax.cn/v1/chat/completions');assert.equal(options.redirect,'manual');const request=JSON.parse(options.body);assert.equal(request.reasoning_split,true);assert.equal(request.stream_options.include_usage,true);return new Response(body,{status});};}
test('stream output, actual usage and provenance',async()=>{const r=await runMiniMax(input(),fake());assert.equal(r.text,'结论');assert.equal(r.usage.totalTokens,32);assert.equal(r.responseId,'test-response');assert.ok(!JSON.stringify(r).includes('never display'));});
test('missing usage remains unknown',async()=>{assert.equal(parseUsage({}),null);assert.equal(parseUsage({prompt_tokens:1,completion_tokens:-1,total_tokens:0}),null);});
test('error body is not exposed',async()=>{await assert.rejects(runMiniMax(input(),fake('private account details',401)),/MINIMAX_HTTP_401/);});
test('incomplete stream fails closed',async()=>{await assert.rejects(runMiniMax(input(),fake(success.replace('data: [DONE]\n\n',''))),/INCOMPLETE_STREAM/);});
test('truncated completion is not success',async()=>{await assert.rejects(runMiniMax(input(),fake(success.replace('"stop"','"length"'))),/MINIMAX_FINISH_length/);});
test('reasoning format never enters display callback',async()=>{let calls=0;await assert.rejects(runMiniMax({...input(),onText:()=>calls++},fake(success.replace('结论','<think>hidden</think>answer'))),/UNEXPECTED_REASONING_FORMAT/);assert.equal(calls,0);});
test('cancelled request never calls provider',async()=>{const c=new AbortController();c.abort();let calls=0;await assert.rejects(runMiniMax({...input(),signal:c.signal},async()=>{calls++;return new Response();}));assert.equal(calls,0);});
test('unknown region/model blocked',async()=>{await assert.rejects(runMiniMax({...input(),region:'other'},fake()),/MODEL_NOT_CONFIGURED/);await assert.rejects(runMiniMax({...input(),model:'unknown'},fake()),/MODEL_NOT_CONFIGURED/);});
test('unicode split into bytes decodes correctly',async()=>{const bytes=new TextEncoder().encode(success);let i=0;const f=async()=>new Response(new ReadableStream({pull(c){if(i===bytes.length)c.close();else c.enqueue(bytes.slice(i,i+=1));}}));assert.equal((await runMiniMax(input(),f)).text,'结论');});
const config={approved:true,maxCalls:2,maxInputBytes:1000,maxOutputTokens:100,maxCostMicros:100000,inputMicrosPerToken:1,outputMicrosPerToken:2,minIntervalMs:100};
test('approval required',()=>assert.throws(()=>new ExecutionBudget({...config,approved:false}),/BUDGET_NOT_APPROVED/));
test('call and rate caps include failures/reservations',()=>{const b=new ExecutionBudget(config);b.reserve(10,10,100);assert.throws(()=>b.reserve(10,10,150),/RATE_LIMIT/);b.reserve(10,10,200);assert.throws(()=>b.reserve(10,10,300),/CALL_LIMIT/);assert.equal(b.snapshot().calls,2);});
test('cost and token caps reject before dispatch',()=>{const b=new ExecutionBudget({...config,maxCostMicros:1000});assert.throws(()=>b.reserve(1,1),/COST_LIMIT/);assert.equal(b.snapshot().calls,0);assert.throws(()=>b.reserve(1001,1),/TOKEN_LIMIT/);});

test('redirect response is rejected, never followed',async()=>{await assert.rejects(runMiniMax(input(),fake('',302)),/MINIMAX_HTTP_302/);});
