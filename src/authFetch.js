const nativeFetch = window.fetch.bind(window)

function shouldAttachToken(url) {
  const value = typeof url === 'string' ? url : url?.url || ''
  if (!value) return false
  return value.includes('/api/') || value.includes('/auth/logout')
}

function withAuthorization(init = {}) {
  const token = localStorage.getItem('token')
  if (!token) return init

  const headers = new Headers(init.headers || {})
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return { ...init, headers }
}

export function installAuthFetch() {
  window.fetch = (input, init = {}) => {
    if (!shouldAttachToken(input)) {
      return nativeFetch(input, init)
    }
    return nativeFetch(input, withAuthorization(init))
  }
}
