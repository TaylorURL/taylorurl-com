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
import { SITE } from './lib/site/current.js'
import { dayIn } from './lib/time/zone.js'

// The year the legal line at the foot of every page carries.
//
// It is stamped here, once, because every route is rendered to markup at build
// time and adopted by the browser from that markup: a year read from a clock is
// read from two different clocks, the build container's and the reader's, and a
// reader whose clock says another year is handed a text node that disagrees
// with the one in front of it. React answers that by throwing the subtree away
// and drawing it again, and it files the mismatch as an error against the site.
//
// Read in Central, like every other date in this project, so the line turns
// over at midnight where the company keeps its hours rather than in UTC.
//
// Set on the environment as well as defined for the bundle, and for the same
// reason `process.env.SITE` is: esbuild substitutes the literal into the
// browser chunk, while the prerender's in-process SSR keeps a real environment
// read, and this process is the one that renders it. `lib/time/built.js` is
// what reads it.
process.env.BUILD_YEAR = dayIn().slice(0, 4)

// Where a local server sends `/api`. The functions only run on Vercel, so on
// localhost every console screen, the status board and the free tools asked a
// server that had nothing behind it and drew empty. Passing the calls through
// to the live deployment of the site being built gives a local preview the
// real data, read with the same sign-in the browser holds. `API_ORIGIN` points
// it somewhere else, such as a `vercel dev` running beside it.
const API_PROXY = {
  '/api': {
    target: process.env.API_ORIGIN || SITE.origin,
    changeOrigin: true,
    secure: true,
  },
}

export default defineConfig({
  server: { proxy: API_PROXY },
  // Bundled when the dev server starts rather than discovered on the first
  // visit to the console. Discovered late, Vite re-bundles mid-session, and a
  // browser still holding the earlier bundle runs the charts against a second
  // copy of React: the console then fails with "ReactSharedInternals.H" and the
  // error screen.
  optimizeDeps: {
    include: ['recharts', '@supabase/supabase-js', 'dompurify'],
  },
  preview: { proxy: API_PROXY },
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
    'process.env.BUILD_YEAR': JSON.stringify(process.env.BUILD_YEAR),
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
    // The entry's own static dependencies keep their preload tags, and the
    // prerender hands every one of them the same low priority the entry gets,
    // so none of them shares a phone's first second with the sheet or the two
    // faces behind it.
    //
    // The motion library used to be filtered out of this list, on the reading
    // that a static import of the entry is fetched either way and the tag only
    // decides when. It is not: the boot in `vite/prerender-plugin.js` holds the
    // entry's `import()` until the document has finished parsing and two frames
    // have gone by, and nothing asks for a dependency that carries no tag until
    // that import instantiates the graph. Measured on the built site from a
    // phone, the entry was in hand at 574ms and the motion chunk was not asked
    // for until 2,468ms - a round trip the entry could not execute through, with
    // the landed route's own chunk queued behind it and the page hydrating at
    // 2,782ms. The tag is what lets it arrive in the same breath as the entry
    // and sit in the cache until the boot wants it.
    modulePreload: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
})
