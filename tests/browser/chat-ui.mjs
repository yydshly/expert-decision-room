import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

// All content is synthetic. Browser traffic is restricted to the local fixture server.
const origin='http://127.0.0.1:4784';
const fixtureId='11111111-1111-4111-8111-111111111111';
const missingId='22222222-2222-4222-8222-222222222222';
const expertId='33333333-3333-4333-8333-333333333333';
const fixtureText=`**给定事实（引用消息ID）**\n- ${fixtureId}：纸飞机飞行距离未知。\n- ${missingId}：来源尚未核实。\n\n**我的看法**\n先测量，再讨论改进。`;
let records=[
 {id:expertId,kind:'expert',title:'虚构研究发言',role:'需求与资讯研究员',body:fixtureText,source:`实际模型运行：MOCK；响应：mock-response-id；关联消息：${fixtureId}`,created_at:'2026-10-07T00:01:00Z'},
 {id:fixtureId,kind:'session',title:'虚构的纸飞机问题',role:'本人',body:'虚构测试：纸飞机能飞多远？',source:'chat:v1:pending:explore',created_at:'2026-10-07T00:00:00Z'},
];
let mode='success',calls=0,stops=0;const held=[];const errors=[];const external=[];const checks=[];const consoleErrors=[];const failedRequests=[];
const check=(name)=>checks.push({name,status:'passed'});
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,2000));});
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
mkdirSync('test-results',{recursive:true});
const events=(values)=>values.map(x=>JSON.stringify(x)).join('\n')+'\n';
try{
 await page.route('**/*',async route=>{
  const request=route.request();const url=new URL(request.url());
  if(url.origin!==origin){external.push(url.origin);return route.abort('blockedbyclient');}
  if(url.pathname==='/api/workspace')return route.fulfill({json:{records}});
  if(url.pathname==='/api/chat'){
   const d=request.postDataJSON();records.unshift({id:d.id,kind:'session',title:d.text,role:'本人',body:d.text,source:'chat:v1:pending:'+d.intent,created_at:new Date().toISOString()});return route.fulfill({json:{records}});
  }
  if(url.pathname==='/api/chat-run'){
   if(url.searchParams.get('action')==='stop'){stops++;return route.fulfill({json:{status:'stopped'}});}
   calls++;const d=request.postDataJSON();const current=mode;
   if(current==='hold'){
    await new Promise(resolve=>held.push(resolve));
    // Late transport output must not overwrite a stopped/newer round. No model is called.
    return route.fulfill({contentType:'application/x-ndjson',body:events([{type:'dispatch',role:'旧轮不应显示'},{type:'complete',completed:0}])}).catch(()=>{});
   }
   if(current==='error')return route.fulfill({contentType:'application/x-ndjson',body:events([{type:'start',roles:3},{type:'stopped',completed:0,error:'MINIMAX_HTTP_429'}])});
   if(current==='broken')return route.fulfill({contentType:'application/x-ndjson',body:events([{type:'start',roles:3}])});
   const body=`这是第${calls}轮模拟回复。\n\n**我的建议**\n- 阈值只是待验证建议\n- 先做一次测量`;
   records.unshift({id:crypto.randomUUID(),kind:'expert',title:'模拟回复',role:'需求与资讯研究员',body,source:`实际模型运行：MOCK；关联消息：${d.triggerId}`,created_at:new Date().toISOString()});
   return route.fulfill({contentType:'application/x-ndjson',body:events([{type:'start',roles:3},{type:'dispatch',role:'需求与资讯研究员'},{type:'result',role:'需求与资讯研究员'},{type:'complete',completed:1}])});
  }
  // Other backend APIs are not needed for this test. Never let an unexpected route call a provider.
  if(url.pathname.startsWith('/api/'))throw new Error('Unexpected API request: '+url.pathname);
  return route.continue();
 });
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 await page.locator('.readableMessage').filter({hasText:'先测量，再讨论改进。'}).first().waitFor();
 const bubbleText=(await page.locator('.bubble').allTextContents()).join('\n');
 assert.ok(!bubbleText.includes(fixtureId)&&!bubbleText.includes(missingId)&&!bubbleText.includes('**'));
 await page.getByText('（引用消息暂不可用）',{exact:false}).waitFor();
 assert.equal(await page.locator('.messageTechnical[open]').count(),0);
 await page.getByRole('link',{name:'你：虚构的纸飞机问题',exact:true}).click();
 assert.ok(page.url().includes('#message-'+fixtureId));
 check('Known references resolve; missing references remain explicit; markdown renders; debug details collapsed');
 await page.screenshot({path:'test-results/readable-citations-after.png',fullPage:true});
 await page.evaluate(raw=>{const e=document.querySelector('.readableMessage');if(e)e.textContent='模拟旧版渲染（虚构消息，用于复现问题）\n'+raw;},fixtureText);
 await page.screenshot({path:'test-results/citation-bug-synthetic-before.png',fullPage:true});
 await page.reload({waitUntil:'networkidle'});
 for(const name of ['架构取舍','岗位与学习','海底场景教学'])await page.getByRole('button',{name,exact:true}).click();
 assert.equal(calls,0);check('Scenario buttons fill drafts without triggering execution');
 const input=page.getByRole('textbox',{name:'发给群里的消息'});
 const send=async text=>{await input.fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click();};
 await send('虚构测试：请给出自然分段和两个要点。');
 await page.getByText('这是第1轮模拟回复。',{exact:true}).waitFor();
 assert.equal(calls,1);assert.ok(await page.locator('.readableMessage ul li').count()>=2);
 await page.getByText('本轮完成 · 继续发送消息即可接着聊',{exact:true}).waitFor();check('User send executes once and renders natural paragraphs/list');
 mode='hold';await send('虚构测试：这一轮用于停止。');
 await page.getByRole('button',{name:'停止本轮',exact:true}).waitFor();
 await Promise.all([page.waitForResponse(r=>r.url().includes('action=stop')),page.getByRole('button',{name:'停止本轮',exact:true}).click()]);
 held.splice(0).forEach(resolve=>resolve());
 await page.getByText('已停止；已完成的发言保留。已提交的调用可能仍计入用量',{exact:true}).waitFor();
 assert.equal(calls,2);check('Stop during pending execution keeps completed messages and does not start another request');
 mode='hold';await send('虚构测试：旧轮，稍后插话。');await page.getByRole('button',{name:'停止本轮',exact:true}).waitFor();
 mode='success';await send('虚构测试：现在改讨论纸船。');
 await page.getByText('这是第4轮模拟回复。',{exact:true}).waitFor();held.splice(0).forEach(resolve=>resolve());
 await page.getByText('本轮完成 · 继续发送消息即可接着聊',{exact:true}).waitFor();
 assert.equal(await page.getByText('旧轮不应显示',{exact:false}).count(),0);assert.ok(stops>=2);check('New message interrupts prior request; stale transport output cannot replace current status');
 mode='error';await send('虚构测试：模拟限流故障。');await page.getByRole('alert').filter({hasText:'MINIMAX_HTTP_429'}).waitFor();
 await page.getByText('虚构测试：模拟限流故障。',{exact:true}).waitFor();check('Provider error stays visible and saved question remains');
 mode='broken';await send('虚构测试：模拟断流。');await page.getByRole('alert').filter({hasText:'连接中断'}).waitFor();check('Incomplete stream is reported instead of silently marked complete');
 mode='success';await send('虚构测试：恢复后再讨论。');await page.getByText('这是第7轮模拟回复。',{exact:true}).waitFor();check('A new user request can recover after an error');
 await page.screenshot({path:'test-results/chat-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);check('390px mobile layout has no document horizontal overflow');
 await page.screenshot({path:'test-results/chat-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);check('No browser runtime errors and no external requests');
 const summary={status:'passed',checks,calls,stops,modelCalls:0,fixture:'synthetic paper-plane messages only',pageErrors:errors,externalRequests:external};writeFileSync('test-results/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}catch(error){writeFileSync('test-results/page.html',await page.content().catch(()=>''));writeFileSync('test-results/summary.json',JSON.stringify({status:'failed',checks,calls,stops,modelCalls:0,pageErrors:errors,consoleErrors,failedRequests,externalRequests:external,url:page.url(),bodyText:(await page.locator('body').innerText().catch(()=>'' )).slice(0,5000),error:String(error)},null,2));await page.screenshot({path:'test-results/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{held.splice(0).forEach(resolve=>resolve());await browser.close();}
