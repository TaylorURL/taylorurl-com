import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useToast } from '@components/Toast'
import { SUPPORT_EMAIL } from '@constants/navigation'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const toast = useToast()

  const handleNewsletterSubmit = e => {
    e.preventDefault()
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Newsletter Signup&body=Please add me to your newsletter: ${email}`
    toast('Opening your email client — thanks for subscribing!')
    setEmail('')
  }

  return (
    <section className="relative border-t border-gray-200 bg-gray-50 py-24 overflow-hidden">
      <div className="grid-pattern absolute inset-0 opacity-[0.02]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center md:p-12">
          <MessageSquare className="mx-auto mb-6 h-12 w-12 text-blue-500" />
          <h2 className="mb-4 text-2xl font-bold text-gray-900 md:text-3xl">
            Free Stuff for <span className="logo-wave-dark">Your Business</span>
          </h2>
          <p className="mb-8 text-gray-600">
            Occasional tips on getting more customers online. No fluff, no sales funnels — just
            stuff that actually works.
          </p>
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500">Free. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  )
}
