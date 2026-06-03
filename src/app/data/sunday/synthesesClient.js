import { supabase } from '@data/supabaseClient'

const SYNTHESIS_FIELDS =
  'id, date, summary, themes, accomplishments, pending, queued_for_tomorrow, surprises, created_at'

export async function getLatestSynthesis() {
  const { data, error } = await supabase
    .from('sunday_syntheses')
    .select(SYNTHESIS_FIELDS)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getSynthesisForDate(date) {
  const { data, error } = await supabase
    .from('sunday_syntheses')
    .select(SYNTHESIS_FIELDS)
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listRecentSyntheses({ limit = 14 } = {}) {
  const { data, error } = await supabase
    .from('sunday_syntheses')
    .select(SYNTHESIS_FIELDS)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
