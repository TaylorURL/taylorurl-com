-- Raw page view events from the tracking beacon
CREATE TABLE IF NOT EXISTS page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id uuid REFERENCES websites(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  page_url text NOT NULL,
  referrer text,
  country text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_website_created ON page_views (website_id, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views (website_id, visitor_id, created_at);

-- Uptime check results from periodic ping service
CREATE TABLE IF NOT EXISTS uptime_checks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id uuid REFERENCES websites(id) ON DELETE CASCADE,
  status_code integer,
  response_time_ms integer,
  is_up boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_website_created ON uptime_checks (website_id, created_at);
