-- Requires pg_cron and pg_net extensions (enabled by default on Supabase Pro)
-- Requires the anon key stored in Vault:
--   SELECT vault.create_secret('<anon-key>', 'supabase_anon_key');

-- Ping all active sites every 5 minutes
SELECT cron.schedule(
  'check-uptime',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-service/check-uptime',
      body    := '{}'::jsonb,
      headers := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}',
                        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1))::jsonb
    );
  $$
);

-- Roll up analytics into website_stats every hour
SELECT cron.schedule(
  'aggregate-stats',
  '13 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-service/aggregate-stats',
      body    := '{}'::jsonb,
      headers := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}',
                        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key' LIMIT 1))::jsonb
    );
  $$
);
