import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Shield, LogOut, Loader2, ExternalLink, X } from 'lucide-react'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'

const ROLE_BADGE_STYLES = {
  admin: 'bg-brand-50 text-brand-700 border-brand-200',
  staff: 'bg-amber-50 text-amber-700 border-amber-200',
  client: 'bg-gray-50 text-gray-500 border-gray-200',
}

const SIDEBAR_ANIMATION = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
  transition: { type: 'spring', damping: 30, stiffness: 300 },
}

function NavItem({ to, icon: Icon, label, isActive, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`relative mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600" />
      )}
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {label}
    </Link>
  )
}

/** Fixed left sidebar for all dashboard-shell routes. */
export default function DashboardSidebar({ isOpen, onClose }) {
  const { user, profile, signOut, isStaff, isAdmin } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Client'
  const initials = displayName
    .split(' ')
    .map(nameSegment => nameSegment[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const roleName = profile?.role || 'client'
  const hasElevatedAccess = isStaff() || isAdmin()

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    toast('Signed out successfully')
  }

  const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    ...(hasElevatedAccess ? [{ to: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
  ]

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="relative flex shrink-0 flex-col items-center justify-center border-b border-gray-200 py-6">
        <Link to="/" className="flex items-center justify-center">
          <img src="/images/TaylorURL-Logo.png" alt="TaylorURL" className="h-56 w-auto" />
        </Link>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:text-gray-600 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User profile */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
            <span
              className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_BADGE_STYLES[roleName] || ROLE_BADGE_STYLES.client}`}
            >
              {roleName}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <p className="mb-2 px-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Menu
        </p>
        <div className="space-y-1">
          {navLinks.map(link => (
            <NavItem
              key={link.to}
              {...link}
              isActive={location.pathname === link.to}
              onClick={onClose}
            />
          ))}
        </div>
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 px-5 py-4">
        <Link
          to="/"
          className="mb-3 flex items-center gap-2 text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Back to site
        </Link>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {isOpen && (
        <motion.aside
          {...SIDEBAR_ANIMATION}
          className="fixed inset-y-0 left-0 z-40 w-64 border-r border-gray-200 bg-white shadow-xl lg:hidden"
        >
          {sidebarContent}
        </motion.aside>
      )}
    </>
  )
}
