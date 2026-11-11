import nodemailer from 'npm:nodemailer@10.4.0';
import { createHash, timingSafeEqual } from 'node:crypto';
import { buildMessage, classifySmtpError } from './message.mjs';

const hash=(s:string)=>createHash('sha256').update(s).digest();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

Deno.serve(async request=>{
    const secret=Deno.env.get('FEEDBACK_DISPATCH_SECRET') || '';
    if(secret.length<32 || !timingSafeEqual(hash(request.headers.get('X-Feedback-Secret') || ''),hash(secret)))return json({error:'unauthorized'},401);
    if(request.method!=='POST')return json({error:'method_not_allowed'},405);
    const username=Deno.env.get('FEEDBACK_SMTP_USERNAME') || '';
    const password=Deno.env.get('FEEDBACK_SMTP_PASSWORD') || '';
    const recipient=Deno.env.get('FEEDBACK_RECIPIENT_EMAIL') || '';
    const url=Deno.env.get('SUPABASE_URL') || '';
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if(!username || !password || !recipient || !url || !key)return json({error:'not_configured'},503);
    let id:string|null;
    try {
        const text=await request.text();
        if(text.length>1024)return json({error:'request_too_large'},413);
        const input=JSON.parse(text);
        if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>k!=='id')
            || (input.id!=null && (typeof input.id!=='string' || !uuid.test(input.id))))return json({error:'invalid_request'},400);
        id=input.id || null;
    }catch{return json({error:'invalid_request'},400);}
    const rpc=async(name:string,body:unknown)=>{
        const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',
            headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
            body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('storage_unavailable');
        return response.json();
    };
    const smtp=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,
        auth:{user:username,pass:password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},
        connectionTimeout:8000,greetingTimeout:8000,socketTimeout:12000,disableFileAccess:true,disableUrlAccess:true});
    const result={accepted:0,failed:0};
    try {
        for(let n=0;n<(id?1:3);n++){
            const job=await rpc('claim_help_feedback',{p_id:id});
            if(!job)break;
            let status='failed',messageId:string|null=null,error:string|null=null,unsent=false,message;
            try{message=buildMessage(job,username,recipient);}catch{error='invalid_message';unsent=true;}
            if(message){
                try{
                    const sent=await smtp.sendMail(message);
                    status='sent';messageId=sent.messageId;result.accepted++;
                }catch(failure){
                    const classified=classifySmtpError(failure);
                    status=classified.status;error=classified.error;unsent=classified.unsent;
                }
            }
            if(status!=='sent')result.failed++;
            const finished=await rpc('finish_help_feedback',{p_id:job.id,p_lease:job.lease_token,
                p_status:status,p_message_id:messageId,p_error:error,p_definitely_unsent:unsent});
            if(!finished)throw Error('lease_changed');
            if(status==='retry')break;
        }
        return json(result);
    }catch{return json({error:'delivery_unavailable'},503);}
    finally{smtp.close();}
});
