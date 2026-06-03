import { config } from './config.js'
import { getSupabase } from './supabase.js'

const supabase = getSupabase()
const GITHUB_API = 'https://api.github.com'

/** Authenticated fetch against the GitHub REST API. */
async function ghFetch(path, init = {}) {
  if (!config.githubToken) throw new Error('GITHUB_TOKEN not configured')
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sunday-code-daemon',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`GitHub ${response.status}: ${body.slice(0, 200)}`)
  }
  return response.json()
}

/**
 * Sync the authenticated user's repos into sunday_github_repos.
 * Paginates up to 5 pages × 100 repos (covers ~500 repos — plenty for one person).
 */
export async function syncGithubRepos() {
  if (!config.githubToken) {
    return { skipped: true, reason: 'GITHUB_TOKEN not set' }
  }

  const fetched = []
  for (let page = 1; page <= 5; page++) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      sort: 'pushed',
      direction: 'desc',
      affiliation: 'owner,collaborator,organization_member',
    })
    const batch = await ghFetch(`/user/repos?${params.toString()}`)
    if (!Array.isArray(batch) || batch.length === 0) break
    fetched.push(...batch)
    if (batch.length < 100) break
  }

  const rows = fetched.map((repo) => ({
    user_id: config.userId,
    github_id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    owner: repo.owner?.login ?? '',
    description: repo.description,
    private: !!repo.private,
    archived: !!repo.archived,
    fork: !!repo.fork,
    default_branch: repo.default_branch,
    language: repo.language,
    html_url: repo.html_url,
    ssh_url: repo.ssh_url,
    clone_url: repo.clone_url,
    pushed_at: repo.pushed_at,
    github_updated_at: repo.updated_at,
    stargazers_count: repo.stargazers_count ?? 0,
    open_issues_count: repo.open_issues_count ?? 0,
    topics: repo.topics ?? [],
    last_synced_at: new Date().toISOString(),
  }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from('sunday_github_repos')
      .upsert(rows, { onConflict: 'user_id,github_id' })
    if (error) throw new Error(`upsert repos: ${error.message}`)
  }

  // Remove cached repos that no longer exist on GitHub (renamed/deleted).
  const seenIds = rows.map((r) => r.github_id)
  if (seenIds.length > 0) {
    await supabase
      .from('sunday_github_repos')
      .delete()
      .eq('user_id', config.userId)
      .not('github_id', 'in', `(${seenIds.join(',')})`)
  }

  const auto = await autoTrackAllRepos()
  return {
    synced: rows.length,
    autoTracked: auto.created,
    syncedAt: new Date().toISOString(),
  }
}

/**
 * Auto-track every non-archived cached GitHub repo as a Sunday project.
 * Skips archived repos (let the user opt-in via chat if they want those tracked).
 * Idempotent: only creates rows for repos that don't already have a linked project.
 * Never auto-archives or auto-modifies existing projects — user remains in control.
 */
export async function autoTrackAllRepos() {
  const { data: repos, error: repoErr } = await supabase
    .from('sunday_github_repos')
    .select('github_id, name, full_name, description, language')
    .eq('user_id', config.userId)
    .eq('archived', false)
  if (repoErr) throw new Error(`auto-track: ${repoErr.message}`)
  if (!repos || repos.length === 0) return { created: 0 }

  const { data: existing, error: existingErr } = await supabase
    .from('sunday_projects')
    .select('github_repo_id')
    .eq('user_id', config.userId)
    .not('github_repo_id', 'is', null)
  if (existingErr) throw new Error(`auto-track existing: ${existingErr.message}`)
  const trackedIds = new Set((existing ?? []).map((p) => Number(p.github_repo_id)))

  const toCreate = repos.filter((r) => !trackedIds.has(Number(r.github_id)))
  if (toCreate.length === 0) return { created: 0 }

  const rows = toCreate.map((r) => ({
    user_id: config.userId,
    name: r.name,
    stack: r.language ?? null,
    notes: r.description ?? null,
    repo_path: defaultRepoPath(r.name),
    github_repo_id: r.github_id,
    github_full_name: r.full_name,
    status: 'active',
  }))

  const { error: insertErr } = await supabase.from('sunday_projects').insert(rows)
  if (insertErr) throw new Error(`auto-track insert: ${insertErr.message}`)
  return { created: rows.length }
}

/** Read cached repos (no API call). */
export async function listCachedRepos({ search, language, limit = 50, includeArchived = false } = {}) {
  let query = supabase
    .from('sunday_github_repos')
    .select(
      'github_id, name, full_name, owner, description, private, archived, fork, default_branch, language, html_url, pushed_at, stargazers_count, open_issues_count',
    )
    .eq('user_id', config.userId)
    .order('pushed_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit), 1), 200))
  if (!includeArchived) query = query.eq('archived', false)
  if (language) query = query.eq('language', language)
  if (search) {
    const escaped = String(search).replace(/[%_]/g, '\\$&')
    query = query.or(`full_name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }
  const { data, error } = await query
  if (error) throw new Error(`listCachedRepos: ${error.message}`)
  return data ?? []
}

/** List open issues for a repo (live from GitHub, not cached). */
export async function listRepoIssues(fullName, { state = 'open', limit = 20 } = {}) {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) throw new Error('full_name must be "owner/repo"')
  const params = new URLSearchParams({ state, per_page: String(Math.min(limit, 50)) })
  const issues = await ghFetch(`/repos/${owner}/${repo}/issues?${params.toString()}`)
  return (issues ?? [])
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)),
      url: i.html_url,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }))
}

/**
 * Promote a cached GitHub repo to a Sunday-tracked project.
 * If the project already exists (by github_repo_id), returns the existing row.
 */
export async function trackRepoAsProject(fullName, { repoPath, notes } = {}) {
  const { data: cached, error: cacheErr } = await supabase
    .from('sunday_github_repos')
    .select('github_id, name, full_name, language, description, html_url')
    .eq('user_id', config.userId)
    .eq('full_name', fullName)
    .single()
  if (cacheErr) throw new Error(`repo not in cache: ${fullName}`)

  const { data: existing } = await supabase
    .from('sunday_projects')
    .select('id, name, repo_path, status')
    .eq('user_id', config.userId)
    .eq('github_repo_id', cached.github_id)
    .maybeSingle()
  if (existing) return { project: existing, alreadyTracked: true }

  const resolvedRepoPath = repoPath ?? defaultRepoPath(cached.name)

  const { data, error } = await supabase
    .from('sunday_projects')
    .insert({
      user_id: config.userId,
      name: cached.name,
      stack: cached.language ?? null,
      notes: notes ?? cached.description ?? null,
      repo_path: resolvedRepoPath,
      github_repo_id: cached.github_id,
      github_full_name: cached.full_name,
    })
    .select('id, name, repo_path, status, github_full_name')
    .single()
  if (error) throw new Error(`trackRepoAsProject: ${error.message}`)
  return { project: data, alreadyTracked: false }
}

function defaultRepoPath(name) {
  const base = config.githubCloneBase
  if (!base) return null
  return `${base.replace(/\/$/, '')}/${name}`
}
