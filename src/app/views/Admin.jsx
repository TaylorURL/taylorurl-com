import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
  LogOut,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  BarChart3,
  Shield,
} from 'lucide-react'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { supabase } from '@app/lib/supabase'

const STATUS_OPTIONS = ['active', 'maintenance', 'development', 'down', 'paused']

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
  maintenance: {
    label: 'Maintenance',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    icon: AlertTriangle,
  },
  development: { label: 'In Development', color: 'text-blue-600', bg: 'bg-blue-50', icon: Clock },
  down: { label: 'Down', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  paused: { label: 'Paused', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
}

const EMPTY_SITE = { name: '', domain: '', status: 'development', notes: '', user_id: '' }

export default function Admin() {
  const { user, profile, signOut, isAdmin, isStaff } = useAuth()
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

  useEffect(() => {
    if (!isStaff() && !isAdmin()) {
      navigate('/dashboard', { replace: true })
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)

    const { data: sites } = await supabase
      .from('websites')
      .select('*, website_stats(*), profiles(full_name)')
      .order('created_at', { ascending: false })

    setWebsites(sites || [])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: false })

    setUsers(profiles || [])
    setLoading(false)
  }

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
      notes: site.notes || '',
    })
  }

  const handleSave = async id => {
    setSaving(true)
    const { error } = await supabase.from('websites').update(editForm).eq('id', id)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Website updated')
      setEditingId(null)
      await loadData()
    }
    setSaving(false)
  }

  const handleDelete = async id => {
    const { error } = await supabase.from('websites').delete().eq('id', id)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Website deleted')
      await loadData()
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    // Guard: only confirmed admins may update roles. This call must be migrated
    // to a server-side edge function with RLS enforcement to prevent privilege
    // escalation via client-side token manipulation (OWASP A01:2021).
    if (!profile || profile.role !== 'admin') {
      toast('Unauthorized', 'error')
      return
    }

    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Role updated')
      await loadData()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    toast('Signed out')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-28 md:pt-36">
      <Seo title="Admin Panel" description="Manage websites and users." path="/admin" />

      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-sm text-gray-500">Manage client websites and users</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
          {[
            { id: 'websites', label: 'Websites', icon: Globe },
            { id: 'users', label: 'Users', icon: Users },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : tab === 'websites' ? (
          <>
            {/* Add Website */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                All Websites ({websites.length})
              </h2>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Add Website
              </button>
            </div>

            {showAdd && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border border-gray-200 bg-white p-5"
              >
                <h3 className="mb-4 font-semibold text-gray-900">New Website</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Website name"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <input
                    type="text"
                    placeholder="domain.com"
                    value={addForm.domain}
                    onChange={e => setAddForm({ ...addForm, domain: e.target.value })}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <select
                    value={addForm.status}
                    onChange={e => setAddForm({ ...addForm, status: e.target.value })}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={addForm.user_id}
                    onChange={e => setAddForm({ ...addForm, user_id: e.target.value })}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Assign to self</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.id.slice(0, 8)} ({u.role})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={addForm.notes}
                    onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:col-span-2"
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false)
                      setAddForm({ ...EMPTY_SITE })
                    }}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* Website list */}
            <div className="space-y-3">
              {websites.map(site => {
                const st = STATUS_CONFIG[site.status] || STATUS_CONFIG.active
                const StatusIcon = st.icon
                const isEditing = editingId === site.id

                return (
                  <div
                    key={site.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editForm.domain}
                            onChange={e => setEditForm({ ...editForm, domain: e.target.value })}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                          />
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>
                                {STATUS_CONFIG[s].label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editForm.notes}
                            onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                            placeholder="Notes"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(site.id)}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                            <Globe className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{site.name}</h3>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {st.label}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <a
                                href={`https://${site.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:text-blue-600"
                              >
                                {site.domain} <ExternalLink className="h-3 w-3" />
                              </a>
                              <span>Owner: {site.profiles?.full_name || 'Unknown'}</span>
                            </div>
                            {site.notes && (
                              <p className="mt-1.5 text-sm text-gray-500">{site.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(site)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(site.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {websites.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
                  <Globe className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No websites yet. Add one above.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Users tab */
          <>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">All Users ({users.length})</h2>
            <div className="space-y-3">
              {users.map(u => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{u.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-500">{u.id.slice(0, 8)}...</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-blue-50 text-blue-600'
                          : u.role === 'staff'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {u.role}
                    </span>
                    {isAdmin() && u.id !== user.id && (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none"
                      >
                        <option value="client">Client</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
