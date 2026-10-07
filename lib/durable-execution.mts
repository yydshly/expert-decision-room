/** D1 gates only. No HTTP execution endpoint and no automatic grant creation. */
export type DB=Pick<D1Database,'prepare'|'batch'>;
export const CLAIM_SQL=`UPDATE execution_grants SET active_run=? WHERE owner=? AND grant_id=? AND status='approved' AND expires_at>? AND active_run IS NULL AND calls_used<6 RETURNING grant_id`;
export const RESERVE_SQL=`UPDATE execution_grants SET calls_used=calls_used+1,input_bytes_used=input_bytes_used+?,output_tokens_reserved=output_tokens_reserved+?,last_call_at=?,reservation_token=?
 WHERE owner=? AND grant_id=? AND active_run=? AND status='approved' AND expires_at>?
 AND calls_used<6 AND input_bytes_used+?<=48000 AND output_tokens_reserved+?<=24576
 AND (last_call_at=0 OR ?-last_call_at>=10000)
 AND NOT EXISTS(SELECT 1 FROM execution_calls WHERE id=?)
 AND (SELECT COUNT(*) FROM execution_calls WHERE owner=? AND grant_id=? AND arm=?)<3
 AND COALESCE((SELECT SUM(input_bytes) FROM execution_calls WHERE owner=? AND grant_id=? AND arm=?),0)+?<=24000
 AND COALESCE((SELECT SUM(output_tokens) FROM execution_calls WHERE owner=? AND grant_id=? AND arm=?),0)+?<=12288
 RETURNING reservation_token`;
export const RECORD_RESERVATION_SQL=`INSERT INTO execution_calls(id,owner,grant_id,run_id,arm,input_bytes,output_tokens,status,created_at)
 SELECT ?,owner,grant_id,active_run,?,?,?,'reserved',? FROM execution_grants WHERE owner=? AND grant_id=? AND active_run=? AND reservation_token=?`;
export async function claimRun(db:DB,owner:string,grantId:string,runId:string,now=Date.now()){
 const r=await db.prepare(CLAIM_SQL).bind(runId,owner,grantId,now).all();if(r.results.length!==1)throw new Error('EXECUTION_NOT_AUTHORIZED_OR_LOCKED');
}
export async function reserveCall(db:DB,input:{owner:string;grantId:string;runId:string;callId:string;arm:'single'|'multi';inputBytes:number;outputTokens:number},now=Date.now()){
 const {owner,grantId,runId,callId,arm,inputBytes,outputTokens}=input;
 if(!['single','multi'].includes(arm)||!Number.isSafeInteger(inputBytes)||inputBytes<0||inputBytes>8000||!Number.isSafeInteger(outputTokens)||outputTokens<1||outputTokens>4096)throw new Error('INVALID_CALL_LIMIT');
 const token=crypto.randomUUID();
 const result=await db.batch([
  db.prepare(RESERVE_SQL).bind(inputBytes,outputTokens,now,token,owner,grantId,runId,now,inputBytes,outputTokens,now,callId,owner,grantId,arm,owner,grantId,arm,inputBytes,owner,grantId,arm,outputTokens),
  db.prepare(RECORD_RESERVATION_SQL).bind(callId,arm,inputBytes,outputTokens,now,owner,grantId,runId,token)
 ]);
 if(result[0].results?.length!==1||result[1].meta?.changes!==1)throw new Error('BUDGET_RATE_OR_DUPLICATE_BLOCKED');
 return {callId,reserved:true};
}
export async function stopRun(db:DB,owner:string,grantId:string){await db.prepare("UPDATE execution_grants SET status='stopped' WHERE owner=? AND grant_id=?").bind(owner,grantId).run();}
export async function canContinue(db:DB,owner:string,grantId:string,runId:string,now=Date.now()){
 const row=await db.prepare("SELECT grant_id FROM execution_grants WHERE owner=? AND grant_id=? AND active_run=? AND status='approved' AND expires_at>?").bind(owner,grantId,runId,now).first();return !!row;
}
export async function finishCall(db:DB,input:{owner:string;grantId:string;runId:string;callId:string;status:'succeeded'|'failed'|'cancelled';result:unknown}){
 // Caller strips secrets/reasoning and checks latest user message before any contribution write.
 const payload=JSON.stringify(input.result);if(payload.length>100000)throw new Error('RESULT_LIMIT');
 await db.prepare("UPDATE execution_calls SET status=?,result_json=? WHERE id=? AND owner=? AND grant_id=? AND run_id=? AND status='reserved'").bind(input.status,payload,input.callId,input.owner,input.grantId,input.runId).run();
 // Never refund reservations after errors or cancellation: the provider may have billed them.
}

/** Each explicit new user message can start one new bounded run; never refill the same trigger. */
export const START_CHAT_SQL=`INSERT INTO execution_grants(owner,grant_id,expires_at,status) VALUES (?,?,?,'approved')
 ON CONFLICT(owner) DO UPDATE SET grant_id=excluded.grant_id,expires_at=excluded.expires_at,status='approved',active_run=NULL,calls_used=0,input_bytes_used=0,output_tokens_reserved=0,last_call_at=0,reservation_token=NULL
 WHERE execution_grants.grant_id!=excluded.grant_id AND (execution_grants.status IN ('completed','stopped') OR execution_grants.expires_at<?)
 AND NOT EXISTS(SELECT 1 FROM execution_calls WHERE owner=excluded.owner AND grant_id=excluded.grant_id)
 RETURNING grant_id`;
export async function startChatGrant(db:DB,owner:string,triggerId:string,now=Date.now()){
 const r=await db.prepare(START_CHAT_SQL).bind(owner,triggerId,now+10*60*1000,now).all();if(r.results.length!==1)throw new Error('RUN_ACTIVE_OR_ALREADY_USED');
}

export const CHAT_APPEND_SQL=`INSERT INTO records(id,owner,kind,title,body,source,role,created_at) SELECT ?,?,'expert',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM execution_grants WHERE owner=? AND grant_id=? AND active_run=? AND status='approved') AND ?=(SELECT id FROM records WHERE owner=? AND role='本人' AND source LIKE 'chat:v1:%' ORDER BY created_at DESC,id DESC LIMIT 1)`;
