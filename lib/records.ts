import { z } from 'zod';
export const kinds=['session','evidence','expert','objection','decision','task','feedback','constraint'] as const;
export const recordInput=z.object({id:z.string().uuid(),kind:z.enum(kinds),title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).max(16000),source:z.string().max(2000).default(''),role:z.string().max(100).default('本人')}).strict();
export type RecordInput=z.infer<typeof recordInput>;
export type Entry=RecordInput & {created_at:string};
export const labels:Record<string,string>={session:'议题',evidence:'证据',expert:'专家分析',objection:'异议',decision:'决定',task:'今天的一件事',feedback:'执行反馈',constraint:'约束变更'};
export const inputSchema={type:'object',properties:{id:{type:'string',format:'uuid'},kind:{type:'string',enum:kinds},title:{type:'string',maxLength:160},body:{type:'string',maxLength:16000},source:{type:'string',description:'原始链接、观察日期，或实际分析的会话来源'},role:{type:'string',description:'实际作者或专家角色，禁止伪造来源'}},required:['id','kind','title','body'],additionalProperties:false};
