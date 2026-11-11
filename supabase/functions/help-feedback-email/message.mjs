const reasons={problem:'Reporte de un problema',suggestion:'Sugerencia',question:'Pregunta'};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function buildMessage(job,sender,recipient) {
    if(job.recipient_email!==recipient || !reasons[job.reason])throw Error('invalid_message');
    const text=`${reasons[job.reason]} desde Ayuda de Zona Diamante\n\nCuenta: ${job.sender_name} (${job.sender_email})\nContacto indicado: ${job.contact || 'No indicado'}\nReferencia: ${job.id}\nFecha: ${job.created_at}\n\n${job.message}`;
    const message={from:{name:'Zona Diamante · Ayuda',address:sender},to:[{address:recipient}],
        subject:`Zona Diamante · Ayuda: ${reasons[job.reason]}`,text,
        html:`<!doctype html><html lang="es"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;color:#2b2b31"><h1 style="color:#008298;font-size:24px">Mensaje de Ayuda</h1><div style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(text)}</div></body></html>`,
        messageId:`<help-${job.id}@gmail.com>`,disableFileAccess:true,disableUrlAccess:true};
    if(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(job.sender_email))message.replyTo={address:job.sender_email};
    return message;
}

export function classifySmtpError(error) {
    const code=Number(error?.responseCode),command=String(error?.command || '');
    const unsent=(code>=400 && code<=599) || /^(CONN|AUTH|EHLO|HELO|STARTTLS|MAIL FROM|RCPT TO)/.test(command);
    if(!unsent)return {status:'uncertain',error:'smtp_confirmation_unknown',unsent:false};
    const retry=!(code>=500 && ![534,535].includes(code));
    return {status:retry?'retry':'failed',error:code?'smtp_'+code:'smtp_unreachable',unsent:true};
}
