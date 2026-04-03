ALTER TABLE client_errors
  ADD COLUMN IF NOT EXISTS github_issue_state text DEFAULT NULL;

COMMENT ON COLUMN client_errors.github_issue_state
  IS 'Cached state of the linked GitHub issue (open, closed). Synced via sync-issue-states endpoint.';
