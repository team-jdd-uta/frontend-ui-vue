import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const absoluteUrlOr = (value, fallback) => {
  return /^https?:\/\//.test(value || '') ? value : fallback
}

const proxyOptions = (target, options = {}) => ({
  target,
  changeOrigin: true,
  secure: target.startsWith('https://'),
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
  ...options,
})

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const roomServiceTarget = absoluteUrlOr(env.VITE_ROOM_SERVICE_URL, 'http://localhost:8082')
  const chatServiceTarget = absoluteUrlOr(env.VITE_CHAT_SERVICE_URL, 'http://localhost:8083')
  const userServiceTarget = absoluteUrlOr(env.VITE_USER_INFO_SERVER_URL, 'http://localhost:8084')
  const loginServiceTarget = absoluteUrlOr(env.VITE_LOGIN_SERVER_URL, 'http://localhost:8081')
  const summaryServiceTarget = absoluteUrlOr(env.VITE_SUMMARY_SERVICE_URL, 'http://localhost:3001')
  const socketTarget = absoluteUrlOr(
    env.VITE_SOCKET_SERVER_URL || env.VITE_SOCKET_BASE_URL,
    'http://localhost:3000'
  )

  return {
    base: env.VITE_BASE || '/',
    plugins: [
      vue(),
      command === 'serve' ? vueDevTools() : undefined,
    ].filter(Boolean),
    server: {
      host: true,
      allowedHosts: [
        '.ngrok-free.app',
      ],
      proxy: {
        '/api/chat/rooms': proxyOptions(roomServiceTarget, {
          rewrite: (path) => path.replace(/^\/api\/chat\/rooms/, '/rooms'),
        }),
        '/api/chat/message': proxyOptions(chatServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/users': proxyOptions(userServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/comments': proxyOptions(userServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/categories': proxyOptions(userServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/login': proxyOptions(loginServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/register': proxyOptions(loginServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/regiester': proxyOptions(loginServiceTarget, {
          rewrite: () => '/register',
        }),
        '/api/logout': proxyOptions(loginServiceTarget, {
          rewrite: (path) => path.replace(/^\/api/, ''),
        }),
        '/api/summaries': proxyOptions(summaryServiceTarget),
        '/api/rooms': proxyOptions(summaryServiceTarget),
        '/socket.io': proxyOptions(socketTarget, {
        '/api/user': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        '/api/room': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        '/api/chat': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          headers: {
            'ngrok-skip-browser-warning': '1',
          },
        },
        '/api/socket': {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget,
          ws: true,
        }),
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
