/**
 * Shared form-field validators, kept small on purpose. Every form on the site
 * wants the same email rule — a syntax check, no DNS lookup — and each address
 * is measured again by the endpoint it reaches, so what runs here saves a round
 * trip rather than deciding anything.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => typeof value === 'string' && EMAIL_REGEX.test(value.trim())

export const hasMinLength = (value, min) => typeof value === 'string' && value.trim().length >= min
