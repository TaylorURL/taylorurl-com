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
