import type { PublicUser } from '#shared/scrum'

export function useAuth() {
  const user = useState<PublicUser | null>('current-user', () => null)
  const request = useRequestFetch()
  async function load() {
    user.value = await request<PublicUser | null>('/api/auth/me')
    return user.value
  }
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST', body: {} })
    user.value = null
    clearNuxtData()
    await navigateTo('/login')
  }
  return { user, load, logout }
}
