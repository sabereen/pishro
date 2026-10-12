import type { PokerSnapshot } from '#shared/models'

export function usePlanningSession(projectId: string, sessionId: string, initial: PokerSnapshot | null) {
  const snapshot = ref(initial)
  const { busy, error, run } = useAction()
  const connection = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
  let stream: EventSource | undefined
  let mounted = false
  let disposed = false
  function connect() {
    if (!mounted || disposed || stream || !snapshot.value) return
    stream = new EventSource(`/api/projects/${projectId}/poker/${sessionId}/events`)
    stream.onopen = () => { connection.value = 'connected' }
    stream.onerror = () => { connection.value = 'reconnecting' }
    stream.addEventListener('snapshot', (event) => {
      if (disposed || busy.value || !(event instanceof MessageEvent) || typeof event.data !== 'string') return
      snapshot.value = JSON.parse(event.data) as PokerSnapshot
    })
  }
  onMounted(() => { mounted = true; connect() })
  onScopeDispose(() => { disposed = true; stream?.close() })
  watch(() => snapshot.value?.session.revision, (revision, previous) => {
    if (previous !== undefined && revision !== previous) void refreshProject(projectId).catch(() => {})
  })
  async function action(action: string, fields: Record<string, unknown> = {}) {
    if (busy.value || disposed) return
    const revision = snapshot.value?.session.revision
    await run(async () => {
      // Pause live updates while the action response becomes the current snapshot.
      stream?.close()
      stream = undefined
      const result = await $fetch<PokerSnapshot>(`/api/projects/${projectId}/poker/${sessionId}`, { method: 'POST', body: { action, revision, ...fields } })
      if (!disposed) snapshot.value = result
    })
    // Reconnect after run clears busy so the stream's initial snapshot is not dropped.
    connect()
  }
  return { snapshot, busy, error, connection, action }
}
