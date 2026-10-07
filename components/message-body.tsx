'use client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {readableMessage,type MessageReference} from '@/lib/message-presentation.mjs';
export function MessageBody({text,records,mine=false}:{text:string;records:MessageReference[];mine?:boolean}){
 if(mine)return <div className="plainMessage">{text}</div>;
 const view=readableMessage(text,records);
 return <div className="readableMessage"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
  a:({href,children})=>href?.startsWith('#message-')?<a className="messageCitation" href={href}>{children}</a>:href&&/^https?:\/\//.test(href)?<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,
  img:({alt})=><span>{alt?'图片：'+alt:'图片未显示'}</span>,
  h1:({children})=><h3>{children}</h3>,h2:({children})=><h3>{children}</h3>,
 }}>{view.text}</Markdown>{view.missingReferences.length>0&&<p className="citationWarning">有引用不在当前加载的记录中，未把它当作已核实依据。</p>}</div>;
}
