import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Lock, Mail, User, Loader2 } from 'lucide-react'
import { BRAND_NAME } from '@constants/navigation'
import Seo from '@components/Seo'
import { useAuth } from '@app/contexts/AuthContext'
import { useToast } from '@components/Toast'
import { pageTransition } from '@constants/animations'

const AUTH_TABS = [
  { id: 'signin', label: 'Sign In' },
  { id: 'signup', label: 'Sign Up' },
]

export default function Auth() {
  const { user, signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' })
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleInputChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    if (activeTab === 'signin') {
      const { error: err } = await signIn(formData.email, formData.password)
      if (err) {
        setError(
          err.message === 'Invalid login credentials' ? 'Invalid email or password.' : err.message
        )
      } else {
        toast('Signed in successfully')
      }
    } else {
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters.')
        setSubmitting(false)
        return
      }
      const { error: err } = await signUp(formData.email, formData.password, {
        full_name: formData.fullName,
      })
      if (err) {
        setError(err.message)
      } else {
        toast('Check your email to confirm your account')
        setActiveTab('signin')
      }
    }
    setSubmitting(false)
  }

  const handleForgotPassword = async e => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: err } = await resetPassword(forgotEmail)
    if (err) {
      setError(err.message)
    } else {
      toast('Password reset email sent')
      setShowForgot(false)
    }
    setSubmitting(false)
  }

  return (
    <motion.div
      {...pageTransition}
      className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-gray-50 px-4 pb-16 pt-28 md:pt-40"
    >
      <Seo
        title="Client Portal"
        description="Sign in to your TaylorURL client portal to manage your project and communicate with your developer."
        path="/auth"
      />
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 text-center"
        >
          <Link to="/" className="inline-block">
            <span className="logo-wave-dark text-3xl font-bold">{BRAND_NAME}</span>
          </Link>
          <p className="mt-2 text-gray-600">Client Portal</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          {showForgot ? (
            <div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900">Reset Password</h3>
              <p className="mb-6 text-sm text-gray-500">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => {
                      setForgotEmail(e.target.value)
                      setError('')
                    }}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    placeholder="you@example.com"
                  />
                </div>
                {error && (
                  <p className="flex items-center gap-1.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot(false)
                    setError('')
                  }}
                  className="w-full text-center text-sm font-medium text-blue-600 hover:underline"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="mb-6 flex rounded-lg border border-gray-200 bg-gray-100 p-1">
                {AUTH_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setError('')
                    }}
                    className={`relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === 'signup' && (
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-12 text-gray-900 transition-colors focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      placeholder={
                        activeTab === 'signup' ? 'At least 6 characters' : 'Enter your password'
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {activeTab === 'signin' && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-600">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgot(true)
                        setForgotEmail(formData.email)
                        setError('')
                      }}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="flex items-center gap-1.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </motion.div>

        {!showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-gray-600">
              {activeTab === 'signin' ? (
                <>
                  Need an account?{' '}
                  <button
                    onClick={() => {
                      setActiveTab('signup')
                      setError('')
                    }}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setActiveTab('signin')
                      setError('')
                    }}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">Client Portal</p>
              <p className="mt-1">
                This portal is for existing TaylorURL clients only. If you&apos;re interested in our
                services, please{' '}
                <Link
                  to="/pricing"
                  className="font-medium text-blue-600 underline hover:no-underline"
                >
                  get in touch
                </Link>{' '}
                to discuss your project.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
