import { supabase } from '@data/supabaseClient'

const DISPATCH_FIELDS =
  'id, project_id, brief, context, status, result_summary, started_at, completed_at, created_at'

export async function listDispatches({ projectId, status, limit = 50 } = {}) {
  let query = supabase
    .from('sunday_code_queue')
    .select(DISPATCH_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (projectId) query = query.eq('project_id', projectId)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getDispatch(id) {
  const { data, error } = await supabase
    .from('sunday_code_queue')
    .select(DISPATCH_FIELDS)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function listDispatchLogs(dispatchId) {
  const { data, error } = await supabase
    .from('sunday_code_logs')
    .select('id, stream, line, created_at')
    .eq('dispatch_id', dispatchId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
