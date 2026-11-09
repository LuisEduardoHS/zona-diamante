"""Explicit activation after the sender test: Supabase Cron + Vault + pg_net."""
import argparse
from pathlib import Path
import subprocess
import sys
import secrets

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))

from app.core.config import Settings


def scheduler_sql(url: str, secret: str) -> str:
    literal = lambda value: "'" + value.replace("'", "''") + "'"
    delimiter = '$config_' + secrets.token_hex(16) + '$'
    return f'''begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do {delimiter}
declare token_id uuid; url_id uuid;
begin
    select id into token_id from vault.secrets where name='zd_trivia_email_secret';
    if token_id is null then perform vault.create_secret({literal(secret)},'zd_trivia_email_secret');
    else perform vault.update_secret(token_id,{literal(secret)}); end if;
    select id into url_id from vault.secrets where name='zd_trivia_email_url';
    if url_id is null then perform vault.create_secret({literal(url)},'zd_trivia_email_url');
    else perform vault.update_secret(url_id,{literal(url)}); end if;
end {delimiter};
select cron.schedule('zd-trivia-email','*/5 * * * *',$job$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='zd_trivia_email_url'),
        headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',
            (select decrypted_secret from vault.decrypted_secrets where name='zd_trivia_email_secret')),
        body := '{{}}'::jsonb,timeout_milliseconds := 60000
    );
$job$);
commit;'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--linked', action='store_true', required=True)
    parser.add_argument('--activate', action='store_true', required=True)
    parser.parse_args()
    config = Settings(_env_file=ROOT / 'backend/.env')
    secret = config.email_dispatch_secret.get_secret_value()
    if not config.trivia_email_enabled or len(secret) < 32 or not config.email_api_url.startswith('https://'):
        raise SystemExit('Configura y prueba primero el remitente y el backend. La activación requiere TRIVIA_EMAIL_ENABLED=true y el mismo EMAIL_DISPATCH_SECRET en Render y backend/.env.')
    folder = ROOT / '.tmp/trivia-email'; folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'private-scheduler.sql'
    try:
        path.write_text(scheduler_sql(config.email_api_url.rstrip('/') + '/api/v1/internal/trivia-email/dispatch', secret), encoding='utf-8')
        result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase.cmd'), 'db', 'query', '--linked', '--file', str(path)],
            cwd=ROOT, capture_output=True, text=True)
        if result.returncode:
            # SQL error context may contain the private secret: never print it.
            raise SystemExit('No se pudo instalar el programador. Revisa permisos de Cron, pg_net y Vault; no se imprimen datos privados.')
        print('Programador activado: revisará la trivia vigente cada cinco minutos. Credencial almacenada en Vault.')
    finally:
        path.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
