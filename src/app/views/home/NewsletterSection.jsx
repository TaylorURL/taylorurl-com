import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useToast } from '@components/Toast'
import { SUPPORT_EMAIL } from '@constants/navigation'
import { BTN_PRIMARY, INPUT, SECTION_H2 } from '@constants/ui'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const toast = useToast()

  const handleNewsletterSubmit = e => {
    e.preventDefault()
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Newsletter Signup')}&body=${encodeURIComponent(`Please add me to your newsletter: ${email}`)}`
    toast('Opening your email client to complete signup.')
    setEmail('')
  }

  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-gray-50 py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.02]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-surface-overlay p-8 text-center md:p-12">
          <MessageSquare aria-hidden="true" className="mx-auto mb-6 h-12 w-12 text-blue-500" />
          <h2 className={`mb-4 ${SECTION_H2}`}>
            Free Stuff for <span className="logo-wave-dark">Your Business</span>
          </h2>
          <p className="mb-8 text-gray-600">
            Occasional tips on getting more customers online — sent by me, not a marketing
            department. No fluff, no sales funnels, just stuff that actually works.
          </p>
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-4 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              aria-label="Email address"
              className={`flex-1 ${INPUT}`}
            />
            <button type="submit" className={BTN_PRIMARY}>
              Subscribe
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-500">Free. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  )
}
