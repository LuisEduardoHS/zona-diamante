"""Real PostgreSQL checks in two disposable, unlinked LOCAL Supabase projects.

No pip/npm installs, remote URL arguments, credentials or source .env files.
Uses the installed Supabase CLI and Docker's psql, so no Python DB driver is
needed. Exit 2 means blocked prerequisites, never a passing/skipped DB suite.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import threading
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[2]
BASE = "611822e"
BOOTSTRAP = "20261016224300_required_collection_teams.sql"
ECONOMY = "20261024000100_isolate_reward_idempotency.sql"
FIRST_CARD_VERSION = "20261016224102"
EXCLUDED = "studio,postgres-meta,edge-runtime,logflare,vector,supavisor,imgproxy,realtime"


class CheckFailure(RuntimeError):
    pass


def command(args, *, input_text=None, timeout=180):
    # Avoid ambient remote connection/auth settings in every child process.
    env = {k: v for k, v in os.environ.items() if not (
        k.startswith("PG") or k.startswith("SUPABASE_") or k == "DATABASE_URL"
    )}
    return subprocess.run(args, input=input_text, capture_output=True,
                          encoding="utf-8", errors="replace", env=env, timeout=timeout)


def require_success(result, step):
    if result.returncode:
        # CLI start prints local secrets on stdout. Never dump captured output.
        raise CheckFailure(f"{step}: exit {result.returncode}; raw output suppressed")
    return result.stdout


def git_file(path):
    return require_success(command(["git", "-C", str(ROOT), "show", f"{BASE}:{path}"]), path)


def baseline_files():
    names = require_success(command([
        "git", "-C", str(ROOT), "ls-tree", "-r", "--name-only", BASE, "supabase/migrations"
    ]), "read base migration names").splitlines()
    if len(names) != 18:
        raise CheckFailure("Expected the 18 historical migrations from 611822e")
    for name in names:
        if (ROOT / name).read_text(encoding="utf-8") != git_file(name):
            raise CheckFailure(f"Historical migration changed: {Path(name).name}")
    return names


def check_tap(output):
    lines = output.splitlines()
    plans = [int(m.group(1)) for line in lines
             if (m := re.fullmatch(r"1\.\.(\d+)", line.strip()))]
    ok = [line for line in lines if re.match(r"^ok \d+\b", line)]
    failed = [line for line in lines if re.match(r"^not ok\b|^Bail out!", line)]
    skipped = any(re.search(r"#\s*(SKIP|TODO)\b", line, re.I) for line in lines)
    numbers = [int(re.match(r"^ok (\d+)\b", line).group(1)) for line in ok]
    if (failed or skipped or len(plans) != 1 or plans[0] == 0
            or plans[0] != len(ok) or numbers != list(range(1, len(ok) + 1))):
        raise CheckFailure(f"pgTAP failure/incomplete plan: {len(ok)} ok, {plans=}, {failed=}")
    return len(ok)


class LocalProject:
    def __init__(self, label, cli):
        self.project_id = f"zd_phase01_{label}_{uuid4().hex[:12]}"
        self.path = ROOT / ".tmp" / self.project_id
        self.path.mkdir(parents=True, exist_ok=False)
        self.supabase = self.path / "supabase"
        (self.supabase / "migrations").mkdir(parents=True)
        self.cli = cli
        self.started = False
        self.marker = self.path / "DISPOSABLE_PHASE01"
        self.marker.write_text(self.project_id, encoding="utf-8")
        config = (ROOT / "supabase/config.toml").read_text(encoding="utf-8")
        config = re.sub(r'^project_id\s*=.*$', f'project_id = "{self.project_id}"', config, flags=re.M)
        allocated = set()

        def free_port(match):
            while True:
                with socket.socket() as sock:
                    sock.bind(("127.0.0.1", 0))
                    port = sock.getsockname()[1]
                if port not in allocated:
                    allocated.add(port)
                    return match.group(1) + str(port)

        config = re.sub(r'^(\s*(?:port|shadow_port|smtp_port|pop3_port|inspector_port)\s*=\s*)\d+',
                        free_port, config, flags=re.M)
        (self.supabase / "config.toml").write_text(config, encoding="utf-8")

    def guard(self):
        if not self.path.resolve().is_relative_to((ROOT / ".tmp").resolve()):
            raise CheckFailure("Refusing a project outside the test workspace")
        if self.marker.read_text(encoding="utf-8") != self.project_id:
            raise CheckFailure("Missing disposable-project marker")
        if not re.fullmatch(r"zd_phase01_(clean|upgrade)_[a-f0-9]{12}", self.project_id):
            raise CheckFailure("Invalid test project identity")
        if (self.supabase / ".temp/project-ref").exists():
            raise CheckFailure("Refusing a remotely linked project")

    def run_cli(self, *args, timeout=300):
        self.guard()
        return require_success(command(
            [self.cli, "--workdir", str(self.path), *args], timeout=timeout
        ), "local Supabase " + " ".join(args))

    def start(self):
        self.started = True  # cleanup also after a partially failed start
        self.run_cli("start", "--exclude", EXCLUDED, timeout=900)

    def stop(self):
        if self.started:
            self.run_cli("stop", "--project-id", self.project_id, "--no-backup", timeout=180)

    def sql_result(self, sql):
        self.guard()
        return command(["docker", "exec", "-i", f"supabase_db_{self.project_id}",
                        "psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1",
                        "-U", "postgres", "-d", "postgres"], input_text=sql)

    def sql(self, sql):
        return require_success(self.sql_result(sql), "SQL in disposable container").strip()

    def value(self, sql):
        return json.loads(self.sql(sql))

    def seed_twice(self):
        snapshot = "select coalesce(jsonb_agg(to_jsonb(t) order by t.slug), '[]') from public.teams t;"
        before = self.value(snapshot)
        seed = (ROOT / "supabase/seed.sql").read_text(encoding="utf-8")
        self.sql(seed)
        self.sql(seed)
        if self.value(snapshot) != before:
            raise CheckFailure("Repeated seed changed existing teams/IDs/editorial content")
        print("PASS: seed twice preserves all team fields and IDs", flush=True)

    def tap(self):
        for path in sorted((ROOT / "supabase/tests/database").glob("*.sql")):
            count = check_tap(self.sql(path.read_text(encoding="utf-8")))
            print(f"PASS: {path.name}: {count} pgTAP assertions", flush=True)


def user(n):
    return f"30000000-0000-4000-8000-{n:012d}"


def fixture_user(project, n, balance=1000):
    project.sql(f"""
        insert into auth.users(id,email,raw_user_meta_data) values
            ('{user(n)}','race-{n}@example.invalid','{{"username":"race_{n}"}}');
        update public.profiles set points_balance={balance} where id='{user(n)}';
        insert into public.reward_events(user_id,event_type,points_delta,idempotency_key)
            values ('{user(n)}','test_funding',{balance},'race-funding-{n}');
    """)


def purchase(n, slug, key):
    return f"select public.purchase_card('{user(n)}',(select id from public.cards where slug='{slug}'),'{key}')"


def daily_fixture(project, n):
    project.sql(f"""
        do $$ begin
            perform public.get_or_create_daily_trivia(current_date);
            perform public.get_or_create_daily_trivia_attempt('{user(n)}',
                (select id from public.daily_trivias where trivia_date=current_date));
        end $$;
        insert into public.trivia_attempt_answers(attempt_id,question_id,selected_option_id)
        select a.id,q.question_id,o.id from public.activity_attempts a
        join public.daily_trivia_questions q on q.daily_trivia_id=a.daily_trivia_id
        join public.trivia_options o on o.question_id=q.question_id and o.is_correct
        where a.user_id='{user(n)}';
    """)
    return project.value(f"""select jsonb_build_object('attempt',a.id,'daily',a.daily_trivia_id,
        'date',t.trivia_date) from public.activity_attempts a
        join public.daily_trivias t on t.id=a.daily_trivia_id where a.user_id='{user(n)}';""")


def finish_daily(n, info):
    return f"select public.complete_daily_trivia_attempt('{user(n)}','{info['attempt']}','{info['daily']}','{info['date']}')"


def race(project, sql_a, sql_b, expected_successes):
    barrier = threading.Barrier(2)

    def run(sql):
        barrier.wait(timeout=10)
        # Separate actual PostgreSQL sessions. Hold economic locks until commit
        # so the other overlapping session exercises lock contention/retries.
        return project.sql_result("begin; set local role service_role; " + sql +
                                  "; select pg_sleep(0.4); commit;")

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run, sql) for sql in (sql_a, sql_b)]
        results = [future.result() for future in futures]
    successes = [r for r in results if r.returncode == 0]
    if len(successes) != expected_successes:
        raise CheckFailure(f"Concurrent operations: expected {expected_successes} successes, got {len(successes)}")
    values = [json.loads(line) for result in successes for line in result.stdout.splitlines()
              if line.startswith("{")]
    if len(values) != expected_successes:
        raise CheckFailure("Missing concurrent result payload")
    return results, values


def assert_state(project, n, balance, purchases, completions, inventory):
    state = project.value(f"""select jsonb_build_object(
        'balance',p.points_balance,
        'purchases',(select count(*) from public.reward_events where user_id=p.id and event_type='card_purchase'),
        'completions',(select count(*) from public.reward_events where user_id=p.id and attempt_id is not null),
        'inventory',(select count(*) from public.user_cards where user_id=p.id),
        'ledger',(select sum(points_delta) from public.reward_events where user_id=p.id)
    ) from public.profiles p where id='{user(n)}';""")
    expected = dict(balance=balance, purchases=purchases, completions=completions,
                    inventory=inventory, ledger=balance)
    if state != expected:
        raise CheckFailure(f"Concurrent state mismatch for fixture {n}: {state}")


def concurrency(project):
    for n in range(9, 16):
        fixture_user(project, n, 250 if n == 10 else 1000)
    _, values = race(project, purchase(9, 'sultanes-de-monterrey', 'same'),
                    purchase(9, 'sultanes-de-monterrey', 'same'), 2)
    if sorted(v['already_processed'] for v in values) != [False, True]:
        raise CheckFailure("Duplicate purchase was not returned as one original + one retry")
    assert_state(project, 9, 750, 1, 0, 1)
    results, _ = race(project, purchase(10, 'sultanes-de-monterrey', 'one'),
                      purchase(10, 'charros-de-jalisco', 'two'), 1)
    if not any('Insufficient points balance.' in r.stderr for r in results if r.returncode):
        raise CheckFailure("Limited-balance race failed for an unexpected reason")
    assert_state(project, 10, 0, 1, 0, 1)
    results, _ = race(project, purchase(11, 'sultanes-de-monterrey', 'one'),
                      purchase(11, 'sultanes-de-monterrey', 'two'), 1)
    if not any('Card already owned.' in r.stderr for r in results if r.returncode):
        raise CheckFailure("Duplicate-card race failed for an unexpected reason")
    assert_state(project, 11, 750, 1, 0, 1)

    for n in (12, 13, 14):
        info = daily_fixture(project, n)
        key = f"daily-trivia:{info['daily']}:{user(n)}"
        other = finish_daily(n, info)
        if n == 13:
            other = purchase(n, 'sultanes-de-monterrey', key)
        elif n == 14:
            other = (f"select public.complete_activity_attempt('{user(n)}','{info['attempt']}',"
                     f"'daily_trivia_completion','{key}',5,100)")
        _, values = race(project, finish_daily(n, info), other, 2)
        if n != 13 and sorted(v['already_processed'] for v in values) != [False, True]:
            raise CheckFailure("Concurrent trivia was not a single completion + retry")
        assert_state(project, n, 850 if n == 13 else 1100, int(n == 13), 1, int(n == 13))
        if project.sql(f"select status from public.activity_attempts where id='{info['attempt']}';") != 'completed':
            raise CheckFailure("Concurrent trivia did not finish the attempt")

    attempt = str(uuid4())
    project.sql(f"insert into public.activity_attempts(id,user_id,activity_type) values ('{attempt}','{user(15)}','game');")
    finish = f"select public.complete_activity_attempt('{user(15)}','{attempt}','game_win','same',1,20)"
    race(project, finish, finish, 2)
    assert_state(project, 15, 1020, 0, 1, 0)
    print("PASS: 7 real concurrent-session scenarios and ledger reconciliation", flush=True)


def upgrade(project, historical_names):
    # Reproduce the old initialized path: pre-collection migrations + old seed,
    # then the five old collection migrations. No source history is rewritten.
    for name in historical_names:
        if Path(name).name[:14] < FIRST_CARD_VERSION:
            (project.supabase / "migrations" / Path(name).name).write_text(git_file(name), encoding="utf-8")
    (project.supabase / "seed.sql").write_text(git_file("supabase/seed.sql"), encoding="utf-8")
    project.start()
    for name in historical_names:
        (project.supabase / "migrations" / Path(name).name).write_text(git_file(name), encoding="utf-8")
    project.run_cli("migration", "up", "--local")
    fixture_user(project, 16)
    project.sql(purchase(16, 'sultanes-de-monterrey', 'historical-purchase') + ';')
    attempt = str(uuid4())
    project.sql(f"""insert into public.activity_attempts(id,user_id,activity_type)
        values ('{attempt}','{user(16)}','game');
        select public.complete_activity_attempt('{user(16)}','{attempt}','game_win','historical-game',1,20);
        update public.teams set history='Editorial content maintained in an existing database'
            where slug='charros-jal';""")
    snapshot_sql = f"""select jsonb_build_object(
        'teams',(select jsonb_agg(to_jsonb(t) order by t.slug) from public.teams t),
        'balance',(select points_balance from public.profiles where id='{user(16)}'),
        'inventory',(select jsonb_agg(to_jsonb(c)) from public.user_cards c where user_id='{user(16)}'),
        'events',(select jsonb_agg(to_jsonb(e) - 'idempotency_version' order by e.id)
                  from public.reward_events e where user_id='{user(16)}')
    );"""
    before = project.value(snapshot_sql)
    for name in (BOOTSTRAP, ECONOMY):
        shutil.copyfile(ROOT / 'supabase/migrations' / name, project.supabase / 'migrations' / name)
    project.run_cli("migration", "up", "--local", "--include-all")
    if project.value(snapshot_sql) != before:
        raise CheckFailure("Upgrade changed existing IDs, editorial data, balance, inventory or historical events")
    for sql in (purchase(16, 'sultanes-de-monterrey', 'historical-purchase'),
                f"select public.complete_activity_attempt('{user(16)}','{attempt}','game_win','historical-game',1,20)"):
        value = project.value('set role service_role; ' + sql + ';')
        if value['already_processed'] is not True:
            raise CheckFailure("Historical operation could not be retried")
    if project.value(snapshot_sql) != before:
        raise CheckFailure("Historical retry changed state")
    if project.sql('select count(*) from supabase_migrations.schema_migrations;') != '20':
        raise CheckFailure("Expected 20 recorded migrations after historical gap-fill")
    print("PASS: upgrade from all 18 historical migrations, preserved data and legacy retries", flush=True)

    # Keep the Phase 1 checkpoint above, then verify subsequent forward-only
    # migrations too. Clean and upgraded environments must run the same schema.
    known = {Path(name).name for name in historical_names} | {BOOTSTRAP, ECONOMY}
    additions = sorted(path for path in (ROOT / 'supabase/migrations').glob('*.sql')
                       if path.name not in known)
    for path in additions:
        shutil.copyfile(path, project.supabase / 'migrations' / path.name)
    if additions:
        project.run_cli("migration", "up", "--local")
        if project.value(snapshot_sql) != before:
            raise CheckFailure("Later migration changed historical economic/editorial data")
        expected = str(20 + len(additions))
        if project.sql('select count(*) from supabase_migrations.schema_migrations;') != expected:
            raise CheckFailure("Missing forward migration in upgraded environment")
        print(f"PASS: {len(additions)} forward migration(s) preserve existing data", flush=True)


def main(extra_checks=None):
    cli = ROOT / "node_modules/.bin" / ("supabase.cmd" if os.name == "nt" else "supabase")
    if not cli.exists() or shutil.which("docker") is None:
        print("BLOCKED: installed Supabase CLI and Docker are required; nothing installed", flush=True)
        return 2
    if command(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=20).returncode:
        print("BLOCKED: Docker engine unavailable; no SQL/migration/concurrency test executed", flush=True)
        return 2
    projects = []
    try:
        names = baseline_files()
        clean = LocalProject("clean", str(cli))
        projects.append(clean)
        for path in (ROOT / 'supabase/migrations').glob('*.sql'):
            shutil.copyfile(path, clean.supabase / 'migrations' / path.name)
        shutil.copyfile(ROOT / 'supabase/seed.sql', clean.supabase / 'seed.sql')
        clean.start()
        clean.run_cli("db", "reset", "--local")
        clean.seed_twice()
        clean.tap()
        concurrency(clean)
        if extra_checks:
            extra_checks(clean)
        clean.stop()
        projects.remove(clean)
        existing = LocalProject("upgrade", str(cli))
        projects.append(existing)
        upgrade(existing, names)
        existing.seed_twice()
        existing.tap()
        concurrency(existing)
        if extra_checks:
            extra_checks(existing)
        existing.stop()
        projects.remove(existing)
        print("PASS: phase 1 database acceptance in both isolated environments", flush=True)
        return 0
    except (CheckFailure, subprocess.TimeoutExpired, OSError) as error:
        print(f"FAILED: {type(error).__name__}: {error}", flush=True)
        return 1
    finally:
        for project in projects:
            try:
                project.stop()
            except (CheckFailure, subprocess.TimeoutExpired, OSError):
                print(f"ATTENTION: test-container cleanup required for {project.project_id}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
