import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Globe,
  Users,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Shield,
  Eye,
  BarChart3,
  Activity,
} from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'

const STATUS_OPTIONS = ['active', 'maintenance', 'development', 'down', 'paused']

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border border-emerald-200',
    icon: CheckCircle2,
  },
  maintenance: {
    label: 'Maintenance',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border border-amber-200',
    icon: AlertTriangle,
  },
  development: {
    label: 'Development',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border border-blue-200',
    icon: Clock,
  },
  down: {
    label: 'Down',
    color: 'text-red-700',
    bg: 'bg-red-50 border border-red-200',
    icon: XCircle,
  },
  paused: {
    label: 'Paused',
    color: 'text-gray-600',
    bg: 'bg-gray-50 border border-gray-200',
    icon: Clock,
  },
}

const ROLE_CONFIG = {
  admin: 'bg-blue-50 text-blue-700 border border-blue-200',
  staff: 'bg-amber-50 text-amber-700 border border-amber-200',
  client: 'bg-gray-50 text-gray-600 border border-gray-200',
}

const ROLE_OPTIONS = ['client', 'staff', 'admin']

const EMPTY_SITE = { name: '', domain: '', status: 'development', notes: '', user_id: '' }

const INPUT_CLASS =
  'w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
const HEADER_BTN =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900'
const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50'
const TH_CLASS =
  'whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400'

const TAB_ITEMS = [
  { id: 'websites', label: 'Websites', icon: Globe },
  { id: 'users', label: 'Users', icon: Users },
]

/** Compact stat display for website table cells */
function StatCell({ visitors, pageViews, uptimePercent }) {
  if (!visitors && !pageViews && !uptimePercent) {
    return <span className="text-xs text-gray-400">No data</span>
  }

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      {visitors != null && (
        <span className="inline-flex items-center gap-1" title="Visitors (30d)">
          <Eye className="h-3 w-3" /> {visitors.toLocaleString()}
        </span>
      )}
      {pageViews != null && (
        <span className="inline-flex items-center gap-1" title="Page views (30d)">
          <BarChart3 className="h-3 w-3" /> {pageViews.toLocaleString()}
        </span>
      )}
      {uptimePercent != null && (
        <span className="inline-flex items-center gap-1" title="Uptime">
          <Activity className="h-3 w-3" /> {uptimePercent}%
        </span>
      )}
    </div>
  )
}

/** Reusable status dropdown */
function StatusSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={INPUT_CLASS}>
      {STATUS_OPTIONS.map(key => (
        <option key={key} value={key}>
          {STATUS_CONFIG[key].label}
        </option>
      ))}
    </select>
  )
}

/** Status badge pill */
function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

export default function Admin() {
  const { user, profile, isAdmin, isStaff } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [websites, setWebsites] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_SITE })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('websites')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: sites }, { data: profiles }] = await Promise.all([
        supabase
          .from('websites')
          .select('*, website_stats(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, role, created_at')
          .order('created_at', { ascending: false }),
      ])

      // Map profile names onto websites since there's no FK join
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
      const sitesWithOwner = (sites ?? []).map(site => ({
        ...site,
        profiles: profileMap[site.user_id] ?? null,
      }))

      setWebsites(sitesWithOwner)
      setUsers(profiles ?? [])
    } catch {
      toast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    if (!isStaff() && !isAdmin()) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadData()
  }, [profile])

  const handleAdd = async () => {
    if (!addForm.name || !addForm.domain) {
      toast('Name and domain are required', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('websites').insert([
      {
        name: addForm.name,
        domain: addForm.domain,
        status: addForm.status,
        notes: addForm.notes || null,
        user_id: addForm.user_id || user.id,
      },
    ])
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Website added')
      setShowAdd(false)
      setAddForm({ ...EMPTY_SITE })
      await loadData()
    }
    setSaving(false)
  }

  const handleEdit = site => {
    setEditingId(site.id)
    setEditForm({
      name: site.name,
      domain: site.domain,
      status: site.status,
      notes: site.notes ?? '',
    })
  }

  const handleSave = async siteId => {
    setSaving(true)
    const { error } = await supabase.from('websites').update(editForm).eq('id', siteId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Website updated')
      setEditingId(null)
      await loadData()
    }
    setSaving(false)
  }

  const handleDelete = async siteId => {
    const { error } = await supabase.from('websites').delete().eq('id', siteId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Website deleted')
      await loadData()
    }
  }

  const handleRoleChange = async (targetUserId, newRole) => {
    // Guard: only confirmed admins may update roles. This call must be migrated
    // to a server-side edge function with RLS enforcement to prevent privilege
    // escalation via client-side token manipulation (OWASP A01:2021).
    if (!profile || profile.role !== 'admin') {
      toast('Unauthorized', 'error')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Role updated')
      await loadData()
    }
  }

  const cancelAdd = () => {
    setShowAdd(false)
    setAddForm({ ...EMPTY_SITE })
  }

  return (
    <>
      <Seo title="Admin Panel" description="Manage websites and users." path="/admin" />

      {/* Header */}
      <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">Administration</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Admin Panel
          </h1>
        </div>
        <button onClick={loadData} className={HEADER_BTN}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="mb-6 inline-flex rounded-lg border border-gray-200 bg-gray-200 p-px">
        {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-[7px] px-5 py-2 text-sm font-medium transition-all ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* --- Content --- */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : tab === 'websites' ? (
        <WebsitesTab
          websites={websites}
          users={users}
          showAdd={showAdd}
          setShowAdd={setShowAdd}
          addForm={addForm}
          setAddForm={setAddForm}
          editingId={editingId}
          editForm={editForm}
          setEditForm={setEditForm}
          saving={saving}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancelEdit={() => setEditingId(null)}
          onCancelAdd={cancelAdd}
        />
      ) : (
        <UsersTab
          users={users}
          currentUserId={user?.id}
          isCurrentUserAdmin={isAdmin()}
          onRoleChange={handleRoleChange}
        />
      )}
    </>
  )
}

/* ========================================================================= */
/*  Websites Tab                                                             */
/* ========================================================================= */

function WebsitesTab({
  websites,
  users,
  showAdd,
  setShowAdd,
  addForm,
  setAddForm,
  editingId,
  editForm,
  setEditForm,
  saving,
  onAdd,
  onEdit,
  onSave,
  onDelete,
  onCancelEdit,
  onCancelAdd,
}) {
  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{websites.length} websites</p>
        <button onClick={() => setShowAdd(!showAdd)} className={`${PRIMARY_BTN} px-4 py-2`}>
          <Plus className="h-4 w-4" />
          Add Website
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">New Website</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Website name"
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className={INPUT_CLASS}
                />
                <input
                  type="text"
                  placeholder="domain.com"
                  value={addForm.domain}
                  onChange={e => setAddForm({ ...addForm, domain: e.target.value })}
                  className={INPUT_CLASS}
                />
                <StatusSelect
                  value={addForm.status}
                  onChange={val => setAddForm({ ...addForm, status: val })}
                />
                <select
                  value={addForm.user_id}
                  onChange={e => setAddForm({ ...addForm, user_id: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">Assign to self</option>
                  {users.map(userProfile => (
                    <option key={userProfile.id} value={userProfile.id}>
                      {userProfile.full_name || userProfile.id.slice(0, 8)} ({userProfile.role})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={addForm.notes}
                  onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                  className={`${INPUT_CLASS} sm:col-span-2`}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={onAdd} disabled={saving} className={`${PRIMARY_BTN} px-4 py-2`}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
                <button
                  onClick={onCancelAdd}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Website Table */}
      {websites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No websites yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className={TH_CLASS}>Site</th>
                <th className={TH_CLASS}>Owner</th>
                <th className={TH_CLASS}>Status</th>
                <th className={TH_CLASS}>Stats</th>
                <th className={`${TH_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {websites.map(site => {
                const isEditing = editingId === site.id
                const websiteStats = site.website_stats?.[0] ?? site.website_stats

                return isEditing ? (
                  <tr key={site.id} className="bg-blue-50/30">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Name"
                          className={INPUT_CLASS}
                        />
                        <input
                          type="text"
                          value={editForm.domain}
                          onChange={e => setEditForm({ ...editForm, domain: e.target.value })}
                          placeholder="Domain"
                          className={INPUT_CLASS}
                        />
                        <StatusSelect
                          value={editForm.status}
                          onChange={val => setEditForm({ ...editForm, status: val })}
                        />
                        <input
                          type="text"
                          value={editForm.notes}
                          onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Notes"
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => onSave(site.id)}
                          disabled={saving}
                          className={`${PRIMARY_BTN} px-3 py-1.5`}
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={site.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{site.name}</div>
                      <a
                        href={`https://${site.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                      >
                        {site.domain}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                      {site.notes && <p className="mt-0.5 text-xs text-gray-400">{site.notes}</p>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-600">
                      {site.profiles?.full_name ?? 'Unknown'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={site.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatCell
                        visitors={websiteStats?.visitors_30d}
                        pageViews={websiteStats?.page_views_30d}
                        uptimePercent={websiteStats?.uptime_pct}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(site)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          aria-label={`Edit ${site.name}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(site.id)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${site.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ========================================================================= */
/*  Users Tab                                                                */
/* ========================================================================= */

function UsersTab({ users, currentUserId, isCurrentUserAdmin, onRoleChange }) {
  const formatJoinDate = dateString => {
    if (!dateString) return '--'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <>
      <p className="mb-4 text-sm font-medium text-gray-500">{users.length} users</p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className={TH_CLASS}>User</th>
              <th className={TH_CLASS}>Role</th>
              <th className={TH_CLASS}>Joined</th>
              {isCurrentUserAdmin && <th className={`${TH_CLASS} text-right`}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(userProfile => (
              <tr key={userProfile.id} className="transition-colors hover:bg-gray-50/50">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-gray-900">
                    {userProfile.full_name || 'No name'}
                  </div>
                  <span className="font-mono text-xs text-gray-400">
                    {userProfile.id.slice(0, 8)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CONFIG[userProfile.role] ?? ROLE_CONFIG.client}`}
                  >
                    {userProfile.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-gray-500">
                  {formatJoinDate(userProfile.created_at)}
                </td>
                {isCurrentUserAdmin && (
                  <td className="px-5 py-3.5 text-right">
                    {userProfile.id !== currentUserId ? (
                      <select
                        value={userProfile.role}
                        onChange={e => onRoleChange(userProfile.id, e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {ROLE_OPTIONS.map(roleKey => (
                          <option key={roleKey} value={roleKey}>
                            {roleKey}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-400">You</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
