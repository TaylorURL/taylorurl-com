import { supabase } from '@data/supabaseClient'

const FIELDS =
  'github_id, name, full_name, owner, description, private, archived, fork, default_branch, language, html_url, pushed_at, stargazers_count, open_issues_count, last_synced_at'

export async function listGithubRepos({ search, includeArchived = false, limit = 200 } = {}) {
  let query = supabase
    .from('sunday_github_repos')
    .select(FIELDS)
    .order('pushed_at', { ascending: false })
    .limit(limit)
  if (!includeArchived) query = query.eq('archived', false)
  if (search) {
    const escaped = String(search).replace(/[%_]/g, '\\$&')
    query = query.or(`full_name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
