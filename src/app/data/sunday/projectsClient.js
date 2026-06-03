import { supabase } from '@data/supabaseClient'

const PROJECT_FIELDS =
  'id, name, repo_path, client, stack, notes, status, github_repo_id, github_full_name, created_at, updated_at'

export async function listProjects({ status } = {}) {
  let query = supabase
    .from('sunday_projects')
    .select(PROJECT_FIELDS)
    .order('updated_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getProject(id) {
  const { data, error } = await supabase
    .from('sunday_projects')
    .select(PROJECT_FIELDS)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
