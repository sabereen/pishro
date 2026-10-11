import type { TaskPickingSnapshot } from '#shared/models'

export function useTaskPicking(
  projectId: string,
  sprintId: string,
  initial: TaskPickingSnapshot | null,
) {
  const snapshot = ref(initial)
  const { busy, error, run } = useAction()
  const connection = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
  const url = `/api/projects/${projectId}/sprints/${sprintId}/picking`
  let stream: EventSource | undefined
  let mounted = false
  let disposed = false
  function connect() {
    if (!mounted || disposed || stream || !snapshot.value) return
    stream = new EventSource(`${url}/events`)
    stream.onopen = () => {
      connection.value = 'connected'
    }
    stream.onerror = () => {
      connection.value = 'reconnecting'
    }
    stream.addEventListener('snapshot', (event) => {
      if (busy.value || !(event instanceof MessageEvent) || typeof event.data !== 'string') return
      snapshot.value = JSON.parse(event.data) as TaskPickingSnapshot
    })
  }
  onMounted(() => {
    mounted = true
    connect()
  })
  onScopeDispose(() => {
    disposed = true
    stream?.close()
  })
  async function action(action: 'pick' | 'release', taskId: string) {
    const task = snapshot.value?.tasks.find((item) => item.id === taskId)
    if (!task) return
    await run(async () => {
      try {
        const result = await $fetch<TaskPickingSnapshot>(url, {
          method: 'POST',
          body: { action, taskId, revision: task.revision },
        })
        if (!disposed) snapshot.value = result
      } catch (cause) {
        // Refresh even on conflicts; never roll back to the stale local assignment.
        const result = await $fetch<TaskPickingSnapshot>(url).catch(() => null)
        if (!disposed && result) snapshot.value = result
        throw cause
      } finally {
        stream?.close()
        stream = undefined
        connect()
      }
    })
  }
  return { snapshot, busy, error, connection, action }
}
