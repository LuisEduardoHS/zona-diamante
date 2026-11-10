"""Linked DB acceptance with all fixture/DDL changes rolled back. Never sends."""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--linked', action='store_true', required=True)
    parser.add_argument('--with-migration', action='store_true')
    parser.add_argument('--with-recipient-migration', action='store_true')
    args = parser.parse_args()
    sql = 'begin;\n'
    if args.with_migration:
        sql += (ROOT / 'supabase/migrations/20261109000100_trivia_email_notifications.sql').read_text(encoding='utf-8')
    if args.with_recipient_migration:
        sql += (ROOT / 'supabase/migrations/20261110000100_trivia_email_public_recipients.sql').read_text(encoding='utf-8')
    sql += '\n' + Path(__file__).with_name('trivia_email_database.sql').read_text(encoding='utf-8') + '\nrollback;\n'
    folder = ROOT / '.tmp/trivia-email'; folder.mkdir(parents=True, exist_ok=True)
    file = folder / 'transaction-check.sql'; file.write_text(sql, encoding='utf-8')
    result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase.cmd'), 'db', 'query', '--linked', '--file', str(file)],
        cwd=ROOT, text=True, capture_output=True)
    print(result.stdout)
    if result.returncode:
        print(result.stderr)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
