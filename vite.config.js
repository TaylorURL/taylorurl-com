import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@components': path.resolve(__dirname, 'src/app/components'),
            '@hooks': path.resolve(__dirname, 'src/app/hooks'),
            '@views': path.resolve(__dirname, 'src/app/views'),
            '@constants': path.resolve(__dirname, 'src/app/constants'),
            '@data': path.resolve(__dirname, 'src/app/data'),
            '@app': path.resolve(__dirname, 'src/app'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    recharts: ['recharts'],
                    'framer-motion': ['framer-motion'],
                },
            },
        },
    },
})
