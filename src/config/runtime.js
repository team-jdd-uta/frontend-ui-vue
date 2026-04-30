const trimTrailingSlash = (value) => String(value || '').replace(/\/$/, '')

export const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api')

export const socketBaseUrl = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_BASE_URL || window.location.origin
)

export const hlsBaseUrl = trimTrailingSlash(import.meta.env.VITE_HLS_BASE_URL || 'http://localhost:8088')
