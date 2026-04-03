import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_APP_SERVER_URL || 'http://localhost:8080'
  const isHttpsTarget = proxyTarget.startsWith('https://')
  const base = env.VITE_BASE_PATH || (mode === 'production' ? '/front/' : '/')

  return {
    base,
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
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
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
  }
})
