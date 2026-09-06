import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import feedPlugin from './vite/feed-plugin.js'
import headOrderPlugin from './vite/head-order-plugin.js'
import inlineScriptPlugin from './vite/inline-script-plugin.js'
import llmsPlugin from './vite/llms-plugin.js'
import sitemapPlugin from './vite/sitemap-plugin.js'
import prerenderPlugin from './vite/prerender-plugin.js'
import reviewSchemaPlugin from './vite/review-schema-plugin.js'
import siteHeadPlugin from './vite/site-head-plugin.js'
import siteStaticPlugin from './vite/site-static-plugin.js'

export default defineConfig({
  // Which site this build is. One tree builds two deployments, and this is the
  // line that makes the key legal in a browser chunk: esbuild substitutes the
  // literal, so the comparison in lib/site/current.js constant-folds and Rollup
  // drops the record that lost. In a Vercel function and in the prerender's
  // in-process SSR the same expression stays a real environment read, and the
  // build container has SITE genuinely set either way.
  //
  // The member expression only. Defining bare `process.env` would clobber
  // process.env.NODE_ENV and ship React's development build to production.
  define: {
    'process.env.SITE': JSON.stringify(process.env.SITE ?? 'taylorurl'),
  },
  plugins: [
    react(),
    // First. It fills in the origin the review-schema plugin then looks the
    // business node up by, and cuts that node entirely for a site that has none.
    siteHeadPlugin(),
    reviewSchemaPlugin(),
    sitemapPlugin(),
    feedPlugin(),
    llmsPlugin(),
    inlineScriptPlugin(),
    headOrderPlugin(),
    prerenderPlugin(),
    // Last. It corrects what `public/` delivered for the site being built, and
    // the pages it reads before removing a file are the ones the prerender above
    // has only just written.
    siteStaticPlugin(),
  ],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/app/components'),
      '@reactbits': path.resolve(__dirname, 'src/app/components/reactbits'),
      '@hooks': path.resolve(__dirname, 'src/app/hooks'),
      '@views': path.resolve(__dirname, 'src/app/views'),
      '@constants': path.resolve(__dirname, 'src/app/constants'),
      '@data': path.resolve(__dirname, 'src/app/data'),
      '@utils': path.resolve(__dirname, 'src/app/utils'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@lib': path.resolve(__dirname, 'lib'),
    },
  },
  build: {
    // Stated rather than inherited. Left to the toolchain's default this moves
    // with the Vite version, and a target older than the browsers the site is
    // actually opened in transpiles working syntax into more code that does the
    // same thing more slowly. es2022 is the floor every browser that supports
    // modules already clears.
    target: 'es2022',
    // The motion library is a static import of the entry, so it is fetched
    // either way; the preload tag only decides whether it is fetched at the
    // same moment as the stylesheet. Nothing above the fold waits on it - the
    // bar and the hero are painted from the served markup - so the fifty
    // kilobytes it takes are fifty the sheet and the fonts behind the sheet do
    // not have to share a phone's first second with.
    modulePreload: {
      resolveDependencies: (_url, deps) => deps.filter(dep => !dep.includes('framer-motion')),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
})
