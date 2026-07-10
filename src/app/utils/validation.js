/**
 * Shared form-field validators. Kept intentionally small — the contact form
 * and the newsletter popup are the only forms in the site, and both want the
 * same email rule (basic syntax check, no DNS).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => typeof value === 'string' && EMAIL_REGEX.test(value.trim())

export const hasMinLength = (value, min) => typeof value === 'string' && value.trim().length >= min
