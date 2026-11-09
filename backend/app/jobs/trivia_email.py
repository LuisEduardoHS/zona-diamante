"""Operator tools. Preview/check never send or queue messages."""
import argparse
import asyncio
from pathlib import Path
from uuid import uuid4

import httpx

from app.core.config import settings
from app.services.trivia_email import configuration_errors, render_notice, send_notice, verify_sender


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    preview = sub.add_parser('preview')
    preview.add_argument('--name', default='Luis')
    preview.add_argument('--output', type=Path, default=Path('../.tmp/trivia-email/preview.html'))
    sub.add_parser('check')
    test = sub.add_parser('send-test', help='Send one explicitly requested test; never sends to registered users.')
    test.add_argument('--to', required=True)
    test.add_argument('--name', default='Luis')
    args = parser.parse_args()
    fixture = {'id': str(uuid4()), 'recipient_name': getattr(args, 'name', 'Luis'),
        'recipient_email': getattr(args, 'to', 'preview@example.invalid'),
        'question_count': 5, 'points_per_correct': 20, 'unsubscribe_token': str(uuid4())}
    if args.action == 'preview':
        notice = render_notice(fixture)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(notice['html'], encoding='utf-8')
        args.output.with_suffix('.txt').write_text(notice['text'], encoding='utf-8')
        print('Vista previa:', args.output.resolve())
        return
    errors = configuration_errors()
    if errors:
        raise SystemExit('Falta configurar: ' + ', '.join(errors))
    async with httpx.AsyncClient(timeout=8.0) as client:
        await verify_sender(client)
        print('Cuenta y remitente verificado: OK. Avisos automáticos:', 'activos' if settings.trivia_email_enabled else 'desactivados')
        if args.action == 'send-test':
            await send_notice(client, fixture)
            print('Brevo aceptó el correo de prueba. Revisa tu bandeja y spam.')


if __name__ == '__main__':
    asyncio.run(main())
