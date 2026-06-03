-- Sunday — GitHub integration.
-- Cache of the user's GitHub repos + linkage from sunday_projects to GitHub repo metadata.

begin;

create table public.sunday_github_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_id bigint not null,
  name text not null,
  full_name text not null,
  owner text not null,
  description text,
  private boolean default false,
  archived boolean default false,
  fork boolean default false,
  default_branch text,
  language text,
  html_url text,
  ssh_url text,
  clone_url text,
  pushed_at timestamptz,
  github_updated_at timestamptz,
  stargazers_count integer default 0,
  open_issues_count integer default 0,
  topics jsonb,
  last_synced_at timestamptz not null default now(),
  unique (user_id, github_id)
);

create index sunday_github_repos_user_pushed_idx
  on public.sunday_github_repos (user_id, pushed_at desc);

create index sunday_github_repos_user_fullname_idx
  on public.sunday_github_repos (user_id, full_name);

alter table public.sunday_projects
  add column if not exists github_repo_id bigint,
  add column if not exists github_full_name text;

create index if not exists sunday_projects_github_repo_idx
  on public.sunday_projects (user_id, github_repo_id);

alter table public.sunday_github_repos enable row level security;

create policy sunday_github_repos_select_own on public.sunday_github_repos
  for select using (auth.uid() = user_id);
create policy sunday_github_repos_insert_own on public.sunday_github_repos
  for insert with check (auth.uid() = user_id);
create policy sunday_github_repos_update_own on public.sunday_github_repos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sunday_github_repos_delete_own on public.sunday_github_repos
  for delete using (auth.uid() = user_id);

do $$ begin
  alter publication supabase_realtime add table public.sunday_github_repos;
exception when duplicate_object then null;
end $$;

commit;
