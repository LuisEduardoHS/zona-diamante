import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMessage,classifySmtpError} from '../../supabase/functions/help-feedback-email/message.mjs';

const recipient='eduardohdz2111@gmail.com';
const job={id:'7e1256de-5d9b-47e9-8c4c-ce1e4266fe05',reason:'suggestion',sender_name:'Nombre',sender_email:'reporter@example.com',
    recipient_email:recipient,contact:'otra@example.com\nCc: atacante@example.com',message:'<script>alert("x")</script>',created_at:'2026-11-11'};

test('Ayuda: correo fijo, contenido escapado y respuesta a la cuenta del remitente',()=>{
    const message=buildMessage(job,recipient,recipient);
    assert.deepEqual(message.to,[{address:recipient}]);
    assert.deepEqual(message.replyTo,{address:'reporter@example.com'});
    assert.ok(message.html.includes('&lt;script&gt;') && !message.html.includes('<script>'));
    assert.ok(message.text.includes('<script>'));
    assert.equal(message.cc,undefined);assert.equal(message.bcc,undefined);
    assert.ok(!message.subject.includes('\n'));
    assert.equal(message.disableFileAccess,true);assert.equal(message.disableUrlAccess,true);
    assert.throws(()=>buildMessage({...job,recipient_email:'atacante@example.com'},recipient,recipient));
});

test('Ayuda: un resultado SMTP incierto nunca provoca un reenvío automático',()=>{
    assert.equal(classifySmtpError({code:'ETIMEDOUT',command:'DATA'}).status,'uncertain');
    assert.equal(classifySmtpError({code:'ECONNRESET'}).unsent,false);
    assert.equal(classifySmtpError({command:'CONN',code:'ECONNECTION'}).status,'retry');
    assert.equal(classifySmtpError({command:'AUTH PLAIN',responseCode:535}).status,'retry');
    assert.equal(classifySmtpError({command:'DATA',responseCode:451}).status,'retry');
    assert.equal(classifySmtpError({command:'RCPT TO',responseCode:550}).status,'failed');
});
