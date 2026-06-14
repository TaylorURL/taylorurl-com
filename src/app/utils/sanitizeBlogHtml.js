import DOMPurify from 'dompurify'

/**
 * Sanitizes trusted in-repo blog HTML before it is injected via
 * `dangerouslySetInnerHTML`. In the browser this runs DOMPurify normally. During
 * build-time prerendering there is no DOM, so DOMPurify stays uninitialized and
 * the content — authored in the repo's blog data, never user input — is passed
 * through unchanged so article bodies still appear in the prerendered HTML for
 * crawlers.
 *
 * @param {string} html - The raw blog block HTML to sanitize.
 * @returns {string} Sanitized HTML in the browser; the input unchanged in SSR.
 */
export function sanitizeBlogHtml(html) {
  return typeof DOMPurify.sanitize === 'function' ? DOMPurify.sanitize(html) : html
}
