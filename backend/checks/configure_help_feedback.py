"""Deploy Help's private Gmail relay; never sends an email or changes Supabase Auth."""
import argparse
import json
import os
from pathlib import Path
import smtplib
import ssl
import subprocess
import sys

from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from app.core.config import Settings


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    config=Settings(_env_file=ROOT/'backend/.env')
    values=dotenv_values(ROOT/'backend/.env')
    username=values.get('FEEDBACK_SMTP_USERNAME') or config.feedback_recipient_email
    password=(values.get('FEEDBACK_SMTP_PASSWORD') or '').replace(' ','')
    secret=config.email_dispatch_secret.get_secret_value()
    if not password or len(secret)<32 or not username.endswith('@gmail.com'):
        raise SystemExit('Falta la contraseña de aplicación de Gmail o el secreto del programador. No se imprimen credenciales.')
    if not args.apply:
        print('Preparado: Gmail SMTP TLS/465 en Supabase; destinatario privado configurado. Agrega --apply para publicar.')
        return
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com',465,timeout=15,context=ssl.create_default_context()) as smtp:
            smtp.login(username,password)
    except smtplib.SMTPException:
        raise SystemExit('Gmail no aceptó la conexión o la contraseña de aplicación; no se publicó.')
    folder=ROOT/'.tmp/help-feedback';folder.mkdir(parents=True,exist_ok=True)
    path=folder/'private-edge-secrets.env'
    ref=config.supabase_url.split('//')[-1].split('.')[0]
    secrets={'FEEDBACK_SMTP_USERNAME':username,'FEEDBACK_SMTP_PASSWORD':password,
        'FEEDBACK_RECIPIENT_EMAIL':config.feedback_recipient_email,'FEEDBACK_DISPATCH_SECRET':secret}
    cli=str(ROOT/'node_modules/.bin/supabase.cmd')
    try:
        path.write_text('\n'.join(k+'='+json.dumps(v) for k,v in secrets.items())+'\n',encoding='utf-8')
        for command in [
            [cli,'secrets','set','--env-file',str(path),'--project-ref',ref],
            [cli,'functions','deploy','help-feedback-email','--use-api','--no-verify-jwt','--project-ref',ref],
        ]:
            result=subprocess.run(command,cwd=ROOT,env=os.environ.copy(),capture_output=True,text=True)
            if result.returncode:
                raise SystemExit('Falló la publicación del relay. Revisa sesión/permisos del CLI; se omite la salida privada.')
        print('Relay privado de Ayuda publicado. Gmail TLS verificado; no se enviaron mensajes ni se modificó Supabase Auth.')
    finally:
        path.unlink(missing_ok=True)


if __name__=='__main__':
    main()
