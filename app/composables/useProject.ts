import type { ProjectOverview } from '#shared/models'

export function useProject() {
  const route = useRoute()
  const id = computed(() => String(route.params.projectId))
  return useFetch<ProjectOverview>(() => `/api/projects/${id.value}`, { key: () => `project-${id.value}` })
}

export async function refreshProject(projectId: string) {
  await refreshNuxtData(`project-${projectId}`)
}
