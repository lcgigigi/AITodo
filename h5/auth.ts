import { useUserStore } from '@/stores/user.store'

const H5_TOKEN_QUERY_KEY = 'token'

export function resolveH5TokenFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get(H5_TOKEN_QUERY_KEY)?.trim()
  if (!token) return null

  params.delete(H5_TOKEN_QUERY_KEY)
  const query = params.toString()
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', nextUrl)

  return token
}

export function applyH5Token(token: string) {
  const userStore = useUserStore()
  userStore.setToken(token)
}

export function bootstrapH5Auth() {
  const urlToken = resolveH5TokenFromUrl()
  if (urlToken) {
    applyH5Token(urlToken)
  }
}
