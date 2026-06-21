import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check } from 'lucide-react'
import { useToast } from '@hooks/useToast'
import { fadeInUp, staggerChild } from '@constants/animations'
import { INPUT_DARK } from '@constants/ui'

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
      toast("You're on the list. Thanks for signing up.")
    } catch (error) {
      setStatus('idle')
      toast(
        error?.message?.length && error.message.length < 200
          ? error.message
          : "Couldn't sign you up just now. Please try again."
      )
    }
  }

  return (
    <section className="relative overflow-hidden border-t border-hair bg-bg py-24 text-ink sm:py-32">
      <div className="grid-blueprint absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-16">
        <div className="grid items-end gap-10 border-b border-hair pb-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              <span className="h-px w-8 bg-accent" />
              // Newsletter
            </p>
            <h2 className="text-[clamp(2.2rem,5.4vw,4.4rem)] font-semibold leading-[1.02] tracking-tightest text-ink">
              Short notes for owners.
              <br />
              <span className="text-accent">Only when worth sending.</span>
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-relaxed text-ink-soft lg:text-right">
            Practical tips on getting found on Google and turning more visitors into paying
            customers. Written by me, sent only when there’s something worth saying.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          {status === 'success' ? (
            <div className="flex items-center gap-4 border border-hair-strong p-8 text-ink">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-accent/50 bg-accent/10">
                <Check className="h-4 w-4 text-accent" strokeWidth={2} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                  // You&apos;re in
                </p>
                <p className="text-[16px] text-ink">Thanks. Watch your inbox.</p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col gap-3 border border-hair p-3 sm:flex-row sm:items-stretch sm:p-2"
            >
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@yourbusiness.com"
                required
                aria-label="Email address"
                className={`${INPUT_DARK} flex-1 border-none bg-transparent px-4 py-3.5 ring-0 focus:ring-0 focus:border-transparent`}
              />
              <button
                type="submit"
                disabled={status === 'submitting'}
                className={`group inline-flex items-center justify-center gap-2.5 rounded-sm bg-accent px-7 py-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition duration-200 ease-out hover:bg-[color:var(--accent-hi)] active:scale-[0.98] ${status === 'submitting' ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                {status !== 'submitting' && (
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </button>
            </form>
          )}
          <div className="grid grid-cols-2 gap-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            <div>
              <p className="mb-2 text-accent">// How often</p>
              <p className="text-ink-soft normal-case tracking-normal">Monthly at most. Skipped when there&apos;s nothing to say.</p>
            </div>
            <div>
              <p className="mb-2 text-accent">// Unsubscribing</p>
              <p className="text-ink-soft normal-case tracking-normal">One click and you&apos;re off. No follow-up emails.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
