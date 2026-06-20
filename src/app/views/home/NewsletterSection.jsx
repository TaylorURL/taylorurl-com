import { useState } from 'react'
import { CheckCircle2, MessageSquare } from 'lucide-react'
import { useToast } from '@hooks/useToast'
import { BTN_PRIMARY, INPUT, SECTION_H2 } from '@constants/ui'

const ENDPOINT = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/collect-email'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const toast = useToast()

  const handleNewsletterSubmit = async event => {
    event.preventDefault()
    if (status === 'submitting') return

    const trimmedEmail = email.trim()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast('Please enter a valid email address.')
      return
    }

    setStatus('submitting')

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          name: '',
          email: trimmedEmail,
          source: 'taylorurl-home',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setEmail('')
      toast("You're subscribed — thanks for signing up!")
    } catch (error) {
      setStatus('idle')
      toast(
        error?.message?.length && error.message.length < 200
          ? error.message
          : "We couldn't sign you up just now. Please try again."
      )
    }
  }

  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-gray-50 py-24">
      <div className="grid-pattern absolute inset-0 opacity-[0.02]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-surface-overlay p-8 text-center md:p-12">
          {status === 'success' ? (
            <>
              <CheckCircle2 aria-hidden="true" className="mx-auto mb-6 h-12 w-12 text-green-500" />
              <h2 className={`mb-4 ${SECTION_H2}`}>You're on the list</h2>
              <p className="text-gray-600">
                Thanks for signing up — keep an eye on your inbox.
              </p>
            </>
          ) : (
            <>
              <MessageSquare aria-hidden="true" className="mx-auto mb-6 h-12 w-12 text-blue-500" />
              <h2 className={`mb-4 ${SECTION_H2}`}>
                Practical tips for <span className="logo-wave-dark">your business</span>
              </h2>
              <p className="mb-8 text-gray-600">
                Short, useful notes on getting found on Google and turning more visitors into
                paying customers. Written by me, sent only when I have something worth saying.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-4 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  required
                  aria-label="Email address"
                  className={`flex-1 ${INPUT}`}
                />
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className={`${BTN_PRIMARY} ${status === 'submitting' ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                </button>
              </form>
              <p className="mt-4 text-sm text-gray-500">Unsubscribe anytime.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
