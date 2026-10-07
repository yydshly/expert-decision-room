import {z} from 'zod';
import {identity,errorResponse} from '@/lib/workspace';
import {queueUserMessage} from '@/lib/chat-orchestrator';
const input=z.object({id:z.string().uuid(),text:z.string().trim().min(1).max(16000),intent:z.enum(['explore','interrupt','summarize']).default('explore')}).strict();
export async function POST(request:Request){try{if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});const v=input.parse(await request.json());return Response.json(await queueUserMessage(identity(request),v));}catch(e){return errorResponse(e);}}
