import { identity,readWorkspace,appendRecord,errorResponse } from '@/lib/workspace';
export async function GET(request:Request){try{return Response.json(await readWorkspace(identity(request)),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});return Response.json(await appendRecord(identity(request),await request.json()));}catch(e){return errorResponse(e);}}
