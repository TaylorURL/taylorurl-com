-- Real-time visitor presence tracking
CREATE TABLE IF NOT EXISTS active_visitors (
  website_id uuid REFERENCES websites(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (website_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_active_visitors_last_seen ON active_visitors (website_id, last_seen);

-- Add visitors_now column to website_stats
ALTER TABLE website_stats ADD COLUMN IF NOT EXISTS visitors_now integer DEFAULT 0;
