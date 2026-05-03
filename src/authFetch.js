const nativeFetch = window.fetch.bind(window)
const authBaseUrl = (import.meta.env.VITE_LOGIN_SERVER_URL || 'https://api.team9.cloud.skala-ai.com/auth').replace(/\/$/, '')

function shouldAttachToken(url) {
  const value = typeof url === 'string' ? url : url?.url || ''
  if (!value) return false
  return value.includes('/api/') || value.includes('/auth/logout')
}

function shouldAttemptRefresh(url) {
  const value = typeof url === 'string' ? url : url?.url || ''
  if (!value) return false
  return value.includes('/api/') && !value.includes('/auth/login') && !value.includes('/auth/refresh')
}

function withAuthorization(init = {}) {
  const token = localStorage.getItem('idToken') || localStorage.getItem('token')
  if (!token) return init

  const headers = new Headers(init.headers || {})
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...init, headers }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) {
    return null
  }

  const response = await nativeFetch(`${authBaseUrl}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json().catch(() => ({}))
  const tokens = data?.tokens || {}
  const accessToken = String(tokens.accessToken || '').trim()
  if (!accessToken) {
    return null
  }

  localStorage.setItem('token', accessToken)
  if (tokens.idToken) {
    localStorage.setItem('idToken', tokens.idToken)
  }
  if (tokens.refreshToken) {
    localStorage.setItem('refreshToken', tokens.refreshToken)
  }
  if (tokens.expiresIn) {
    localStorage.setItem('tokenExpiresIn', String(tokens.expiresIn))
  }

  return accessToken
}

export function installAuthFetch() {
  window.fetch = async (input, init = {}) => {
    if (!shouldAttachToken(input)) {
      return nativeFetch(input, init)
    }

    const authorizedInit = withAuthorization(init)
    const response = await nativeFetch(input, authorizedInit)
    if (![401, 403].includes(response.status) || !shouldAttemptRefresh(input)) {
      return response
    }

    const refreshedToken = await refreshAccessToken()
    if (!refreshedToken) {
      return response
    }

    const retryHeaders = new Headers(authorizedInit.headers || {})
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`)
    return nativeFetch(input, {
      ...authorizedInit,
      headers: retryHeaders
    })
  }
}
