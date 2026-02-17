import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  server: {
    host: true,
    allowedHosts: [
      'b3f3-59-7-128-143.ngrok-free.app',
      '.ngrok-free.app',
    ],
    proxy: {
      '/api/comments': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: true,
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
      },
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: true,
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: true,
        ws: true,
        headers: {
          'ngrok-skip-browser-warning': '1',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
