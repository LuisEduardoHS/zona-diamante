import importlib.util
import json
from pathlib import Path
import re
import pytest

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / 'supabase/templates/auth'
spec = importlib.util.spec_from_file_location('auth_email_config', ROOT / 'backend/checks/configure_auth_emails.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


def test_all_auth_events_have_branded_spanish_templates_and_safe_actions():
    rows = json.loads((FOLDER / 'manifest.json').read_text(encoding='utf-8'))
    assert len(rows) == 13 and len({row['name'] for row in rows}) == 13
    for row in rows:
        html = (FOLDER / row['file']).read_text(encoding='utf-8')
        assert 'lang="es"' in html and 'ZONA DIAMANTE' in html and 'Zona Diamante' in row['subject']
        assert not re.search(r'<(?:script|iframe|form|img)\b', html)
        assert 'unsubscribe' not in html
        if row['section'] == 'template':
            if row['name'] == 'reauthentication':
                assert '{{ .Token }}' in html and '{{ .ConfirmationURL }}' not in html
            else:
                assert 'href="{{ .ConfirmationURL }}"' in html
                assert 'token_hash=' not in html and 'redirect_to=' not in html


def test_management_patch_only_contains_content_subjects_and_no_policy_switches():
    patch = module.template_patch()
    assert len(patch) == 26
    assert all(key.startswith(('mailer_subjects_', 'mailer_templates_')) for key in patch)
    assert not any('enabled' in key for key in patch)
    assert 'mailer_templates_password_changed_notification_content' in patch
    assert 'mailer_templates_recovery_content' in patch


def test_redirect_additions_preserve_existing_origins_and_are_idempotent():
    original = 'http://localhost:5500/**,https://zona-diamante.netlify.app/pages/auth/perfil.html'
    patch = module.redirect_patch({'uri_allow_list': original})
    assert patch['uri_allow_list'].startswith(original + ',')
    assert 'https://zona-diamante.pages.dev/pages/auth/restablecer.html' in patch['uri_allow_list']
    assert module.redirect_patch(patch) == patch


def test_builtin_sender_rollback_clears_credentials_without_weakening_auth():
    patch = module.default_smtp_patch()
    assert patch == {
        'smtp_host': None, 'smtp_port': None, 'smtp_user': None,
        'smtp_pass': None, 'smtp_admin_email': None, 'smtp_sender_name': None,
    }
    assert 'mailer_autoconfirm' not in patch
    assert 'rate_limit_email_sent' not in patch
    assert 'external_email_enabled' not in patch


def test_native_transport_cannot_silently_publish_custom_templates(monkeypatch):
    class Response:
        status_code = 200

        def json(self):
            return {'smtp_host': None, 'mailer_autoconfirm': False}

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def get(self, url):
            return Response()

        def patch(self, *args, **kwargs):
            pytest.fail('Must not publish custom templates without a custom SMTP transport')

    monkeypatch.setenv('SUPABASE_ACCESS_TOKEN', 'test-management-token')
    monkeypatch.setattr(module.httpx, 'Client', Client)
    monkeypatch.setattr(module, 'Settings', lambda **kwargs: type('Config', (), {'supabase_url': 'https://test.supabase.co'})())
    monkeypatch.setattr(module.sys, 'argv', ['configure_auth_emails.py', '--apply'])
    with pytest.raises(SystemExit, match='Configura un SMTP operativo'):
        module.main()
