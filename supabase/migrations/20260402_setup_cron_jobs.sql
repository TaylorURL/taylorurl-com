-- Requires pg_cron and pg_net extensions (enabled by default on Supabase Pro)

-- Ping all active sites every 5 minutes
SELECT cron.schedule(
  'check-uptime',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-service/check-uptime',
      body    := '{}'::jsonb,
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1amd0anFxdXJpbGRxdXJwZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTkxOTAsImV4cCI6MjA3OTQ5NTE5MH0.9jd6izem9wvp9RgYvlzgLhjSAiRxfsCfTxuIQHOunZc"}'::jsonb
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
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1amd0anFxdXJpbGRxdXJwZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTkxOTAsImV4cCI6MjA3OTQ5NTE5MH0.9jd6izem9wvp9RgYvlzgLhjSAiRxfsCfTxuIQHOunZc"}'::jsonb
    );
  $$
);
