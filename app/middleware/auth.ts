export default defineNuxtRouteMiddleware(async (to) => {
  try {
    const user = await useAuth().load()
    if (!user) return navigateTo({ path: '/login', query: { next: to.fullPath } })
  } catch {
    useAuth().user.value = null
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }
})
