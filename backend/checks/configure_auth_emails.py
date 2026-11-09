"""Publish only branded Auth templates and optional SMTP settings via Management API."""
import argparse
import json
import os
from pathlib import Path
import sys

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from app.core.config import Settings


def template_patch() -> dict:
    folder = ROOT / 'supabase/templates/auth'
    patch = {}
    for row in json.loads((folder / 'manifest.json').read_text(encoding='utf-8')):
        name = row['name'] + ('_notification' if row['section'] == 'notification' else '')
        patch['mailer_subjects_' + name] = row['subject']
        patch['mailer_templates_' + name + '_content'] = (folder / row['file']).read_text(encoding='utf-8')
    return patch


def smtp_patch() -> dict:
    values = dotenv_values(ROOT / 'backend/.env')
    if not values.get('BREVO_SMTP_LOGIN') or not values.get('BREVO_SMTP_KEY'):
        raise RuntimeError('Faltan BREVO_SMTP_LOGIN y/o BREVO_SMTP_KEY en backend/.env.')
    return {'smtp_host': 'smtp-relay.brevo.com', 'smtp_port': '587',
        'smtp_user': values['BREVO_SMTP_LOGIN'], 'smtp_pass': values['BREVO_SMTP_KEY'],
        'smtp_admin_email': 'avisos@zonadiamante.dpdns.org', 'smtp_sender_name': 'Zona Diamante'}


def redirect_patch(current: dict) -> dict:
    # The SPA builds auth return URLs using the current origin. Preserve all
    # configured origins and add the exact two production Cloudflare routes.
    existing = [url.strip() for url in (current.get('uri_allow_list') or '').split(',') if url.strip()]
    required = ['https://zona-diamante.pages.dev/pages/auth/perfil.html',
                'https://zona-diamante.pages.dev/pages/auth/restablecer.html']
    return {'uri_allow_list': ','.join(existing + [url for url in required if url not in existing])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--smtp', action='store_true')
    args = parser.parse_args()
    token = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
    if not token:
        raise SystemExit('Configura SUPABASE_ACCESS_TOKEN para la API de administración. No se usa la service_role key.')
    config = Settings(_env_file=ROOT / 'backend/.env')
    ref = config.supabase_url.split('//')[-1].split('.')[0]
    url = f'https://api.supabase.com/v1/projects/{ref}/config/auth'
    with httpx.Client(timeout=30, headers={'Authorization': 'Bearer ' + token}) as client:
        before = client.get(url)
        if before.status_code != 200:
            raise SystemExit('No se pudo consultar Auth. No se publicaron cambios.')
        current = before.json()
        patch = {**template_patch(), **redirect_patch(current)}
        if args.smtp:
            patch.update(smtp_patch())
        print('Plantillas:', len(template_patch()) // 2, '| SMTP:', args.smtp, '| Claves incluidas:', len(patch))
        if not args.apply:
            print('Solo revisión. Agrega --apply para publicar este conjunto limitado de campos.')
            return
        folder = ROOT / '.tmp/auth-email'; folder.mkdir(parents=True, exist_ok=True)
        # Back up only the fields being changed; this file may contain a previous
        # SMTP credential and therefore stays in the ignored local directory.
        (folder / 'rollback-patch.json').write_text(json.dumps({key: current.get(key) for key in patch}, ensure_ascii=False, indent=2), encoding='utf-8')
        response = client.patch(url, json=patch)
        if response.status_code != 200:
            raise SystemExit('Supabase rechazó la configuración. Se omiten datos privados de la respuesta.')
        actual = client.get(url)
        if actual.status_code != 200:
            raise SystemExit('Se publicó, pero no fue posible leer la configuración para verificarla.')
        actual = actual.json()
        for key, value in patch.items():
            if key != 'smtp_pass' and actual.get(key) != value:
                raise SystemExit('La verificación no coincidió para el campo ' + key)
        # Supabase also returns aggregate maps derived from the individual
        # subject/content fields. Those necessarily change with these templates.
        derived = {'mailer_subjects_custom_contents', 'mailer_templates_custom_contents'}
        changed_elsewhere = [key for key in current if key not in patch and key not in derived and actual.get(key) != current[key]]
        if changed_elsewhere:
            raise SystemExit('Otros campos cambiaron durante la publicación: ' + ', '.join(changed_elsewhere))
        print('Configuración publicada y verificada. Confirmaciones, políticas, límites y otros proveedores conservan sus valores.')


if __name__ == '__main__':
    main()
