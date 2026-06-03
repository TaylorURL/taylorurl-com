/**
 * Stable per-browser identifier for the Devices page. Stored once in
 * localStorage and reused on every subsequent page load — survives reloads
 * and re-signs-in, but a new private window / cleared storage = new device.
 *
 * Plus best-effort user-agent parsing for friendly labels.
 */

const STORAGE_KEY = 'sunday.deviceId'

export function getDeviceFingerprint() {
  if (typeof window === 'undefined') return 'ssr'
  let id = window.localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = generateUuid()
    window.localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers — UUID v4-ish from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Parse the current browser's user agent into { label, browser, os,
 * deviceType, userAgent } using a tiny purpose-built matcher. Good enough
 * for human-readable device labels without pulling in a heavy UA library.
 */
export function parseDeviceInfo() {
  if (typeof navigator === 'undefined') {
    return {
      label: 'Unknown device',
      browser: null,
      os: null,
      deviceType: 'desktop',
      userAgent: null,
    }
  }
  const ua = navigator.userAgent ?? ''
  const browser = detectBrowser(ua)
  const os = detectOs(ua)
  const deviceType = detectDeviceType(ua)
  return {
    label: composeLabel(browser, os, deviceType),
    browser,
    os,
    deviceType,
    userAgent: ua,
  }
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera'
  if (/Arc\//.test(ua)) return 'Arc'
  if (/Brave/.test(ua)) return 'Brave'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Browser'
}

function detectOs(ua) {
  if (/iPad/.test(ua)) return 'iPadOS'
  if (/iPhone|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown OS'
}

function detectDeviceType(ua) {
  if (/iPad|Tablet/.test(ua)) return 'tablet'
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return 'mobile'
  return 'desktop'
}

function composeLabel(browser, os, deviceType) {
  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  if (os) return os
  return deviceType
}
