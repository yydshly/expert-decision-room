import { ZodError } from 'zod';
import { env } from 'cloudflare:workers';
import { recordInput } from './records';
function db(){if(!env.DB)throw new Error('存储暂时不可用');return env.DB;}
export function identity(request:Request){const owner=request.headers.get('oai-authenticated-user-id');if(!owner)throw new Error('UNAUTHORIZED');return owner;}
export async function readWorkspace(owner:string){const result=await db().prepare('SELECT id,kind,title,body,source,role,created_at FROM records WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 300').bind(owner).all();return {records:result.results,aiExecution:'user_initiated_only',historyLimit:300};}
export async function appendRecord(owner:string,input:unknown){const v=recordInput.parse(input);const created=new Date().toISOString();const existing=await db().prepare('SELECT owner FROM records WHERE id=?').bind(v.id).first<{owner:string}>();if(existing&&existing.owner!==owner)throw new Error('标识冲突');await db().prepare('INSERT INTO records (id,owner,kind,title,body,source,role,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(v.id,owner,v.kind,v.title,v.body,v.source,v.role,created).run();return readWorkspace(owner);}
export function errorResponse(e:unknown){if(e instanceof ZodError)return Response.json({error:'内容格式无效，请检查必填字段和长度。输入仍保留。'},{status:400});const message=e instanceof Error?e.message:'';if(message==='UNAUTHORIZED')return Response.json({error:'请登录后再试'},{status:401});console.error('Workspace operation failed',e);return Response.json({error:'保存或读取失败，输入仍保留。请稍后重试。'},{status:503});}
