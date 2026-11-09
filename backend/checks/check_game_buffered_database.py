"""Explicit linked-DB acceptance; every fixture and DDL change is rolled back."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--linked', action='store_true', required=True)
    parser.add_argument('--with-migration', action='store_true')
    args = parser.parse_args()
    rules = json.loads((ROOT / 'backend/app/core/game_beta_rules.json').read_text(encoding='utf-8'))
    sql = 'begin;\n'
    if args.with_migration:
        sql += (ROOT / 'supabase/migrations/20261108000500_buffered_batting_games.sql').read_text(encoding='utf-8')
    sql += "\nselect set_config('zd_test.rules','" + json.dumps(rules).replace("'", "''") + "',true);\n"
    sql += Path(__file__).with_name('game_buffered_database.sql').read_text(encoding='utf-8') + '\nrollback;\n'
    folder = ROOT / '.tmp/game-buffered'; folder.mkdir(parents=True, exist_ok=True)
    file = folder / 'transaction-check.sql'; file.write_text(sql, encoding='utf-8')
    result = subprocess.run([str(ROOT / 'node_modules/.bin/supabase.cmd'), 'db', 'query', '--linked', '--file', str(file)],
                            cwd=ROOT, text=True, capture_output=True)
    print(result.stdout)
    if result.returncode:
        print(result.stderr)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
