import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET

  if (command === 'serve' && !proxyTarget) {
    throw new Error('VITE_PROXY_TARGET is required in .env for dev proxy.')
  }

  const isHttpsTarget = proxyTarget?.startsWith('https://') ?? false

  return {
    base,
    plugins: [
      vue(),
      command === 'serve' ? vueDevTools() : undefined,
    ].filter(Boolean),
    server: proxyTarget ? {
      host: true,
      allowedHosts: [
        '2ea4-211-45-60-5.ngrok-free.app',
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
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          ws: true,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
      },
    } : undefined,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
