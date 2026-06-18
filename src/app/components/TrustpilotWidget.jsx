import { useEffect, useRef } from 'react'
import { BTN_PRIMARY_LG } from '@constants/ui'

// TODO: paste the data-businessunit-id from Trustpilot Business → Integrations → TrustBox
const BUSINESS_UNIT_ID = 'REPLACE_WITH_TRUSTPILOT_BUSINESS_UNIT_ID'

// Trustpilot "Carousel" template (shows review text). Swap to another
// data-template-id if the account exposes a different widget. Note: on the
// free Trustpilot tier some review-text widgets are paywalled and may render
// only a rating badge.
const TEMPLATE_ID = '53aa8807dec7e10d38f59f32'

const BOOTSTRAP_SRC = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'
const REVIEW_URL = 'https://www.trustpilot.com/review/taylorurl.com'
const PLACEHOLDER_ID = 'REPLACE_WITH_TRUSTPILOT_BUSINESS_UNIT_ID'

/**
 * Renders the official Trustpilot TrustBox widget by injecting the bootstrap
 * loader once and calling `Trustpilot.loadFromElement` on mount — including on
 * client-side navigations where the script is already cached. When the
 * business-unit ID is still the placeholder, falls back to an on-brand CTA so
 * the section never shows an empty box.
 */
export default function TrustpilotWidget() {
  const widgetRef = useRef(null)

  useEffect(() => {
    if (BUSINESS_UNIT_ID === PLACEHOLDER_ID) return

    const renderWidget = () => {
      if (widgetRef.current && window.Trustpilot) {
        window.Trustpilot.loadFromElement(widgetRef.current, true)
      }
    }

    if (window.Trustpilot) {
      renderWidget()
      return
    }

    const existing = document.querySelector('script[src*="widget.trustpilot.com/bootstrap"]')
    if (existing) {
      existing.addEventListener('load', renderWidget)
      return () => existing.removeEventListener('load', renderWidget)
    }

    const script = document.createElement('script')
    script.async = true
    script.src = BOOTSTRAP_SRC
    script.addEventListener('load', renderWidget)
    document.head.appendChild(script)

    return () => script.removeEventListener('load', renderWidget)
  }, [])

  if (BUSINESS_UNIT_ID === PLACEHOLDER_ID) {
    return (
      <div className="flex justify-center">
        <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY_LG}>
          Read our reviews on Trustpilot ★
        </a>
      </div>
    )
  }

  return (
    <div
      ref={widgetRef}
      className="trustpilot-widget"
      data-locale="en-US"
      data-template-id={TEMPLATE_ID}
      data-businessunit-id={BUSINESS_UNIT_ID}
      data-style-height="320px"
      data-style-width="100%"
      data-theme="light"
    >
      <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer">
        Trustpilot
      </a>
    </div>
  )
}
