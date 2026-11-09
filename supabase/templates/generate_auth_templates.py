"""Generate the versioned Supabase Go HTML templates (no credentials)."""
from html import escape
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

AUTH = [
    ('confirmation', 'Confirma tu correo | Zona Diamante', 'Confirma tu correo',
     'Te damos la bienvenida a Zona Diamante. Confirma tu correo para entrar a tu cuenta, sumar puntos y comenzar tu colección.',
     'Confirmar mi correo'),
    ('recovery', 'Restablece tu contraseña | Zona Diamante', 'Recupera el acceso a tu cuenta',
     'Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente botón para elegir una nueva y volver a Zona Diamante.',
     'Restablecer contraseña'),
    ('invite', 'Tu invitación a Zona Diamante', 'Tienes un lugar en el equipo',
     'Te invitaron a formar parte de Zona Diamante. Acepta la invitación para terminar de configurar tu cuenta.',
     'Aceptar invitación'),
    ('magic_link', 'Tu enlace para entrar | Zona Diamante', 'Vuelve al diamante',
     'Usa este enlace para entrar a tu cuenta de Zona Diamante de forma segura.',
     'Entrar a mi cuenta'),
    ('email_change', 'Confirma el cambio de correo | Zona Diamante', 'Confirma tu nuevo correo',
     'Recibimos una solicitud para cambiar el correo asociado a tu cuenta. Confirma que reconoces este cambio.',
     'Confirmar cambio de correo'),
    ('reauthentication', 'Tu código de seguridad | Zona Diamante', 'Confirma que eres tú',
     'Usa este código de un solo uso para confirmar la acción que solicitaste en tu cuenta de Zona Diamante.', None),
]
SECURITY = [
    ('password_changed', 'Tu contraseña cambió | Zona Diamante', 'Tu contraseña se actualizó',
     'La contraseña de tu cuenta de Zona Diamante se cambió correctamente.', None),
    ('email_changed', 'Tu correo cambió | Zona Diamante', 'Tu correo se actualizó',
     'Se cambió el correo asociado a tu cuenta de Zona Diamante.',
     'Correo anterior: <strong>{{ .OldEmail }}</strong><br>Correo actual: <strong>{{ .Email }}</strong>'),
    ('phone_changed', 'Tu teléfono cambió | Zona Diamante', 'Tu teléfono se actualizó',
     'Se cambió el número de teléfono asociado a tu cuenta.',
     'Teléfono anterior: <strong>{{ .OldPhone }}</strong><br>Teléfono actual: <strong>{{ .Phone }}</strong>'),
    ('identity_linked', 'Nuevo método de acceso | Zona Diamante', 'Vinculaste un método de acceso',
     'Se añadió un método para iniciar sesión en tu cuenta de Zona Diamante.',
     'Proveedor: <strong>{{ .Provider }}</strong>'),
    ('identity_unlinked', 'Método de acceso eliminado | Zona Diamante', 'Se desvinculó un método de acceso',
     'Se eliminó uno de los métodos para iniciar sesión en tu cuenta de Zona Diamante.',
     'Proveedor: <strong>{{ .Provider }}</strong>'),
    ('mfa_factor_enrolled', 'Nueva verificación de seguridad | Zona Diamante', 'Añadiste una verificación',
     'Se añadió un método de verificación adicional para proteger tu cuenta.',
     'Método: <strong>{{ .FactorType }}</strong>'),
    ('mfa_factor_unenrolled', 'Verificación de seguridad eliminada | Zona Diamante', 'Se eliminó una verificación',
     'Se eliminó un método de verificación adicional de tu cuenta.',
     'Método: <strong>{{ .FactorType }}</strong>'),
]


def layout(title, description, body, *, auth):
    greeting = '{{ if .Data.display_name }}Hola, {{ .Data.display_name }}.{{ else }}Hola.{{ end }}' if auth else 'Hola.'
    footer = ('Si no solicitaste esta acción, puedes ignorar este mensaje.' if auth else
              'Si reconoces este cambio, no necesitas hacer nada más. Si no lo reconoces, restablece tu contraseña para proteger tu cuenta.')
    return f'''<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>{escape(title)} | Zona Diamante</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f7f8;color:#2b2b31;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">{escape(description)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px;background:#007f90;color:#ffffff;font-size:19px;font-weight:bold">ZONA DIAMANTE</td></tr>
<tr><td style="padding:32px 28px">
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere">{greeting}</p>
<h1 style="margin:0 0 16px;color:#007f90;font-size:30px;line-height:1.2">{escape(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.65">{escape(description)}</p>
{body}
<p style="margin:24px 0 0;color:#68747b;font-size:13px;line-height:1.65">{footer}</p>
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e5ebee;color:#68747b;font-size:12px;line-height:1.6">Este mensaje está relacionado con el acceso y la seguridad de tu cuenta.<br>Zona Diamante</td></tr>
</table>
</body></html>
'''


def button(label, link):
    return f'''<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f78019;border-radius:12px"><a href="{link}" style="display:inline-block;padding:16px 24px;color:#ffffff;font-size:17px;font-weight:bold;text-decoration:none">{escape(label)}</a></td></tr></table>'''


def generate():
    output = ROOT / 'auth'; output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for slug, subject, title, description, action in AUTH:
        if action:
            body = button(action, '{{ .ConfirmationURL }}')
            body += '''<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#68747b">El enlace tiene vigencia limitada y es de un solo uso. Si el botón no abre, copia esta dirección en tu navegador:</p><p style="margin:8px 0 0;word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:1.6;color:#007f90">{{ .ConfirmationURL }}</p>'''
        else:
            body = '''<p style="margin:0;padding:20px;background:#edf7f8;color:#007f90;border-radius:12px;text-align:center;font-size:32px;letter-spacing:5px;font-weight:bold">{{ .Token }}</p><p style="font-size:13px;line-height:1.6;color:#68747b">Introduce este código en la pantalla donde lo solicitaste.</p>'''
        if slug == 'email_change':
            body = '''<p style="margin:0 0 24px;padding:16px;background:#edf7f8;border-radius:12px;word-break:break-word;font-size:14px;line-height:1.6">Correo actual: {{ .Email }}<br>Nuevo correo: {{ .NewEmail }}</p>''' + body
        (output / (slug + '.html')).write_text(layout(title, description, body, auth=True), encoding='utf-8')
        manifest.append({'section': 'template', 'name': slug, 'subject': subject, 'file': slug + '.html'})
    for slug, subject, title, description, detail in SECURITY:
        body = (f'<p style="margin:0 0 24px;padding:16px;background:#edf7f8;border-radius:12px;word-break:break-word;font-size:14px;line-height:1.6">{detail}</p>' if detail else '')
        body += button('Proteger mi cuenta', 'https://zona-diamante.pages.dev/pages/auth/recuperar.html')
        (output / (slug + '.html')).write_text(layout(title, description, body, auth=False), encoding='utf-8')
        manifest.append({'section': 'notification', 'name': slug, 'subject': subject, 'file': slug + '.html'})
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Generated {len(manifest)} branded Supabase email templates.')
    return manifest


if __name__ == '__main__':
    generate()
