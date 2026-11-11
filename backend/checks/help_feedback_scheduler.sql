-- Explicit deployment step after the endpoint is live. Reuse the existing
-- Vault job secret; this is independent of the trivia opt-in/enabled switch.
do $$
begin
    if not exists(select 1 from vault.decrypted_secrets where name='zd_trivia_email_secret' and length(decrypted_secret)>=32)
        or not exists(select 1 from vault.decrypted_secrets where name='zd_trivia_email_url'
            and decrypted_secret like 'https://%/api/v1/internal/trivia-email/dispatch') then
        raise exception 'Configure the existing email job URL and secret in Vault first.';
    end if;
end $$;
select cron.schedule('zd-help-feedback','*/5 * * * *',$job$
    select net.http_post(
        url := (select replace(decrypted_secret,'/api/v1/internal/trivia-email/dispatch',
            '/api/v1/internal/help-feedback/dispatch') from vault.decrypted_secrets where name='zd_trivia_email_url'),
        headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret',
            (select decrypted_secret from vault.decrypted_secrets where name='zd_trivia_email_secret')),
        body := '{}'::jsonb,timeout_milliseconds := 60000
    );
$job$);
