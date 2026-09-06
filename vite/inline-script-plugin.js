import { transformWithEsbuild } from 'vite'

// Everything with a `src` is a file the bundler already handles, and a JSON-LD
// node is data rather than a program. What is left is the handful of blocks
// written into `index.html` itself, which Vite ships exactly as they are typed.
const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g
const JSON_LD = /type\s*=\s*(['"])application\/ld\+json\1/i

/**
 * Strips comments and layout from the scripts written inline in `index.html`.
 *
 * Those blocks run before anything else on the page, which is why they are
 * inline and why they carry the longest comments in the project. The bundler's
 * minifier reads modules, and these never become one, so without this every
 * page would carry the prose along with the program.
 *
 * Whitespace only. Identifiers and string literals are printed back exactly as
 * they were written, because one of these blocks names the site every error on
 * the page is filed under, and a renamed local is a stack trace that no longer
 * matches the source it was read from.
 */
async function minifyInlineScripts(html) {
  const blocks = [...html.matchAll(INLINE_SCRIPT)]
  let out = html
  for (const [whole, attrs, body] of blocks) {
    if (JSON_LD.test(attrs) || !body.trim()) continue
    const { code } = await transformWithEsbuild(body, 'index-inline.js', {
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: false,
      legalComments: 'none',
    })
    out = out.replace(whole, `<script${attrs}>${code.trim()}</script>`)
  }
  return out
}

export default function inlineScriptPlugin() {
  return {
    name: 'taylorurl-inline-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: minifyInlineScripts,
    },
  }
}
