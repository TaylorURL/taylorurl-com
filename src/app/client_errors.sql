CREATE TABLE IF NOT EXISTS public.client_errors (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project         TEXT NOT NULL,
    error_message   TEXT NOT NULL,
    stack_trace     TEXT,
    source_file     TEXT,
    line_number     INTEGER,
    column_number   INTEGER,
    component_stack TEXT,
    url             TEXT NOT NULL,
    user_agent      TEXT,
    browser         TEXT,
    os              TEXT,
    error_hash      TEXT NOT NULL,
    error_count     INTEGER DEFAULT 1,
    fixed           BOOLEAN DEFAULT FALSE,
    fix_commit_hash TEXT,
    fix_notes       TEXT,
    skipped         BOOLEAN DEFAULT FALSE,
    skip_reason     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_unfixed
    ON public.client_errors (fixed, skipped, project)
    WHERE fixed = FALSE AND skipped = FALSE;

CREATE INDEX IF NOT EXISTS idx_client_errors_hash
    ON public.client_errors (error_hash);

CREATE INDEX IF NOT EXISTS idx_client_errors_created
    ON public.client_errors (created_at);
