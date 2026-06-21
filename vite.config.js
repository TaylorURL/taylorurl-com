import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import sitemapPlugin from './vite/sitemap-plugin.js'
import prerenderPlugin from './vite/prerender-plugin.js'

export default defineConfig({
  plugins: [react(), sitemapPlugin(), prerenderPlugin()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/app/components'),
      '@hooks': path.resolve(__dirname, 'src/app/hooks'),
      '@views': path.resolve(__dirname, 'src/app/views'),
      '@constants': path.resolve(__dirname, 'src/app/constants'),
      '@data': path.resolve(__dirname, 'src/app/data'),
      '@utils': path.resolve(__dirname, 'src/app/utils'),
      '@app': path.resolve(__dirname, 'src/app'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
})
