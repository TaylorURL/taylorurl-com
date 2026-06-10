import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SITE_URL, SITEMAP_ROUTES } from './site-routes.js'

function toUrlEntry({ path, lastmod, changefreq, priority }) {
  const lines = [`    <loc>${SITE_URL}${path}</loc>`]
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`)
  lines.push(`    <changefreq>${changefreq}</changefreq>`)
  lines.push(`    <priority>${priority}</priority>`)
  return `  <url>\n${lines.join('\n')}\n  </url>`
}

/**
 * Build-time Vite plugin that generates `sitemap.xml` from the shared route
 * list (static pages + every blog article) so it never has to be hand-kept.
 */
export default function sitemapPlugin() {
  let outDir = 'dist'
  return {
    name: 'taylorurl-sitemap',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      const body = SITEMAP_ROUTES.map(toUrlEntry).join('\n')
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
      await writeFile(join(outDir, 'sitemap.xml'), xml, 'utf8')
    },
  }
}
