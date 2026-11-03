"""Validate the 12-hour trivia migration in an owned, disposable local stack."""
import json
import shutil
import sys
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlparse

from phase01_database import ROOT, LocalProject, CheckFailure, fixture_user, user, race

MIGRATION = '20261102000100_twelve_hour_trivia.sql'
DAY = '2030-01-14'


def run(project):
    checks = 0

    def check(ok, label):
        nonlocal checks
        checks += 1
        if not ok:
            raise CheckFailure(label)

    def trivia(slot=None):
        args = f"'{DAY}'" + (f",{slot}::smallint" if slot is not None else '')
        return project.value(f'set role service_role; select to_jsonb(t) from public.get_or_create_daily_trivia({args}) t;')

    def start(n, tid):
        return project.value(f"set role service_role; select to_jsonb(t) from public.get_or_create_daily_trivia_attempt('{user(n)}','{tid}') t;")

    def finish(n, tid, aid):
        return project.value(f"set role service_role; select public.complete_daily_trivia_attempt('{user(n)}','{aid}','{tid}','{DAY}');")

    def answer(aid, tid):
        project.sql(f"""insert into public.trivia_attempt_answers(attempt_id,question_id,selected_option_id)
            select '{aid}',q.question_id,o.id from public.daily_trivia_questions q
            join public.trivia_options o on o.question_id=q.question_id and o.is_correct
            where q.daily_trivia_id='{tid}';""")

    fixture_user(project, 400, 0)
    fixture_user(project, 401, 0)
    morning = trivia()
    attempt = start(400, morning['daily_trivia_id'])
    answer(attempt['attempt_id'], morning['daily_trivia_id'])
    reward = finish(400, morning['daily_trivia_id'], attempt['attempt_id'])
    check(reward['points_earned'] == 100, 'original scoring before migration')
    snapshot = """select jsonb_build_object(
        'attempts',(select jsonb_agg(to_jsonb(a) order by a.id) from public.activity_attempts a),
        'rewards',(select jsonb_agg(to_jsonb(r) order by r.id) from public.reward_events r),
        'answers',(select jsonb_agg(to_jsonb(a) order by a.attempt_id,a.question_id) from public.trivia_attempt_answers a),
        'questions',(select jsonb_agg(to_jsonb(q) order by q.daily_trivia_id,q.position) from public.daily_trivia_questions q),
        'profiles',(select jsonb_agg(to_jsonb(p) order by p.id) from public.profiles p));"""
    before = project.value(snapshot)
    project.sql((ROOT/'supabase/migrations'/MIGRATION).read_text(encoding='utf-8'))
    check(project.value(snapshot) == before, 'migration preserves attempts, answers, rewards, profiles and question assignments')
    check(trivia()['daily_trivia_id'] == morning['daily_trivia_id'], 'legacy date RPC preserved')
    check(trivia(0)['daily_trivia_id'] == morning['daily_trivia_id'], 'existing trivia becomes morning period')
    check(start(400, morning['daily_trivia_id'])['attempt_status'] == 'completed', 'completed morning stays locked')
    check(finish(400, morning['daily_trivia_id'], attempt['attempt_id'])['already_processed'], 'historical completion retry idempotent')

    cmd = f"select to_jsonb(t) from public.get_or_create_daily_trivia('{DAY}',1::smallint) t"
    _, results = race(project, cmd, cmd, 2)
    afternoon = results[0]
    check(afternoon['daily_trivia_id'] == results[1]['daily_trivia_id'], 'concurrent period generation creates one trivia')
    check(afternoon['daily_trivia_id'] != morning['daily_trivia_id'], 'afternoon has a new identity')
    check(afternoon['question_count'] == 5 and afternoon['points_per_correct'] == 20, 'question count and points unchanged')
    shared = project.sql(f"""select count(*) from public.daily_trivia_questions a
        join public.daily_trivia_questions b on a.question_id=b.question_id
        where a.daily_trivia_id='{morning['daily_trivia_id']}' and b.daily_trivia_id='{afternoon['daily_trivia_id']}';""")
    check(shared == '0', 'fresh questions at noon when the bank permits')
    tid = afternoon['daily_trivia_id']
    cmd = f"select to_jsonb(t) from public.get_or_create_daily_trivia_attempt('{user(400)}','{tid}') t"
    _, attempts = race(project, cmd, cmd, 2)
    check(attempts[0]['attempt_id'] == attempts[1]['attempt_id'], 'one afternoon attempt per user under concurrency')
    check(start(401, tid)['attempt_id'] != attempts[0]['attempt_id'], 'users have independent attempts')
    aid = attempts[0]['attempt_id']
    answer(aid, tid)
    cmd = f"select public.complete_daily_trivia_attempt('{user(400)}','{aid}','{tid}','{DAY}')"
    _, rewards = race(project, cmd, cmd, 2)
    check(all(r['points_earned'] == 100 for r in rewards), 'unchanged score on concurrent completion')
    check(any(r['already_processed'] for r in rewards), 'duplicate completion credits once')
    totals = project.value(f"""select jsonb_build_object('balance',points_balance,'events',
        (select count(*) from public.reward_events where user_id=p.id and event_type='daily_trivia_completion'))
        from public.profiles p where id='{user(400)}';""")
    check(totals == {'balance': 200, 'events': 2}, 'exactly one reward per period')
    for role in ['anon', 'authenticated']:
        check(project.sql_result(f"set role {role}; {cmd};").returncode != 0, 'private completion '+role)
        check(project.sql_result(f"set role {role}; select public.get_or_create_daily_trivia('{DAY}',1::smallint);").returncode != 0, 'private generation '+role)
    check(project.sql_result(f"select public.get_or_create_daily_trivia('{DAY}',2::smallint);").returncode != 0, 'reject invalid period')
    project.tap()
    print(f'PASS: {checks} trivia-period SQL checks; upgrade preservation, concurrency, independent users, exactly two rewards', flush=True)


def http_checks(project):
    import httpx
    from datetime import date
    from fastapi.testclient import TestClient
    sys.path.insert(0, str(Path(__file__).parents[1]))
    from app.core.config import settings
    from app.main import app
    from app.services import trivia as service

    local = json.loads(project.run_cli('status', '--output', 'json'))
    api = local['API_URL']
    if urlparse(api).hostname != '127.0.0.1':
        raise CheckFailure('Local Auth only')
    fields = ['supabase_url', 'supabase_publishable_key', 'supabase_secret_key']
    prior = [getattr(settings, field) for field in fields]
    prior_period = service.get_current_trivia_period
    try:
        settings.supabase_url = api
        settings.supabase_publishable_key = local['ANON_KEY']
        settings.supabase_secret_key = local['SERVICE_ROLE_KEY']
        tag = uuid4().hex
        signup = httpx.post(api+'/auth/v1/signup', headers={'apikey': local['ANON_KEY']},
                            json={'email': f'trivia-{tag}@example.invalid', 'password': uuid4().hex,
                                  'data': {'username': 'trivia_'+tag}}, timeout=15)
        signup.raise_for_status()
        auth = {'Authorization': 'Bearer '+signup.json()['access_token']}
        client = TestClient(app)
        base = '/api/v1/trivia/daily'

        def request(method, suffix='', **kwargs):
            r = client.request(method, base+suffix, headers=auth, **kwargs)
            if r.status_code != 200:
                raise CheckFailure(f'HTTP {method} {suffix}: {r.status_code}')
            return r.json()

        identities = []
        for slot in [0, 1]:
            # Test-owned server clock only; every operation uses real Auth/API/DB.
            service.get_current_trivia_period = lambda: (date.fromisoformat(DAY), slot)
            status = request('GET')
            if status['status'] != 'available':
                raise CheckFailure('New period unavailable')
            identities.append(status['daily_trivia_id'])
            attempt = request('POST', '/start')
            correct = project.value(f"select jsonb_object_agg(question_id,id) from public.trivia_options where is_correct and question_id in (select question_id from public.daily_trivia_questions where daily_trivia_id='{status['daily_trivia_id']}');")
            for question in attempt['questions']:
                request('PUT', '/answers/'+question['id'], json={'selected_option_id': correct[question['id']]})
            result = request('POST', '/submit')
            retry = request('POST', '/submit')
            if result['next_available_at'] != status['next_available_at']:
                raise CheckFailure('Submit/status boundary mismatch')
            if (result['points_earned'] != 100 or result['points_balance'] != (slot+1)*100
                    or not retry['already_processed'] or retry['points_balance'] != result['points_balance']):
                raise CheckFailure('Reward or idempotence changed')
            if request('GET')['status'] != 'completed':
                raise CheckFailure('Completed period not locked')
            if client.post(base+'/start', headers=auth).status_code != 409:
                raise CheckFailure('Duplicate attempt permitted')
        if identities[0] == identities[1]:
            raise CheckFailure('Same trivia at noon')
        print('PASS: real local Auth/FastAPI/PostgREST, morning and noon trivia, completed lock, 100 points each, idempotent retries', flush=True)
    finally:
        service.get_current_trivia_period = prior_period
        for field, value in zip(fields, prior):
            setattr(settings, field, value)


def main():
    project = LocalProject('upgrade', str(ROOT/'node_modules/.bin/supabase.cmd'))
    try:
        for file in (ROOT/'supabase/migrations').glob('*.sql'):
            if file.name != MIGRATION:
                shutil.copyfile(file, project.supabase/'migrations'/file.name)
        shutil.copyfile(ROOT/'supabase/seed.sql', project.supabase/'seed.sql')
        project.start()
        run(project)
        http_checks(project)
    finally:
        project.stop()


if __name__ == '__main__':
    main()
