ALTER TABLE public.client_errors
    ADD COLUMN IF NOT EXISTS github_issue_number INTEGER,
    ADD COLUMN IF NOT EXISTS github_issue_url TEXT,
    ADD COLUMN IF NOT EXISTS github_repo TEXT;
