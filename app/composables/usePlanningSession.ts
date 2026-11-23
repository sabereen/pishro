import type { PokerSnapshot } from '#shared/models'

export function usePlanningSession(
  projectId: string,
  sessionId: string,
  initial: PokerSnapshot | null,
) {
  const snapshot = ref(initial)
  const { busy, error, run } = useAction()
  const connection = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
  const url = `/api/projects/${projectId}/poker/${sessionId}`
  let stream: EventSource | undefined
  let mounted = false
  let disposed = false
  let streamVersion = 0
  let missedDuringAction = false

  function connect() {
    if (!mounted || disposed || stream || !snapshot.value) return
    stream = new EventSource(`${url}/events`)
    stream.addEventListener('access-ended', () => {
      stream?.close()
      stream = undefined
      snapshot.value = null
      error.value = 'دسترسی شما به این جلسه پایان یافته است.'
    })
    stream.onopen = () => {
      connection.value = 'connected'
    }
    stream.onerror = () => {
      connection.value = 'reconnecting'
    }
    stream.addEventListener('snapshot', (event) => {
      if (disposed || !(event instanceof MessageEvent) || typeof event.data !== 'string') return
      const incoming = JSON.parse(event.data) as PokerSnapshot
      streamVersion++
      if (busy.value) {
        // The POST response will be applied first. A fresh GET then reconciles
        // any concurrent changes observed while the action was in flight.
        missedDuringAction = true
        return
      }
      snapshot.value = incoming
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
  watch(
    () => snapshot.value?.session.revision,
    (revision, previous) => {
      if (previous !== undefined && revision !== previous)
        void refreshProject(projectId).catch(() => {})
    },
  )

  async function action(action: string, fields: Record<string, unknown> = {}) {
    if (busy.value || disposed) return
    const revision = snapshot.value?.session.revision
    missedDuringAction = false
    const succeeded = await run(async () => {
      const result = await $fetch<PokerSnapshot>(url, {
        method: 'POST',
        body: { action, revision, ...fields },
      })
      if (!disposed && snapshot.value) snapshot.value = result
    })
    if (disposed || !snapshot.value) return

    if (!succeeded || missedDuringAction) {
      // A conflict or an SSE frame received during POST means we should read
      // authoritative state. Never overwrite an SSE frame received during GET.
      const versionAtStart = streamVersion
      const latest = await $fetch<PokerSnapshot>(url).catch(() => null)
      if (!disposed && snapshot.value && latest && streamVersion === versionAtStart)
        snapshot.value = latest
    }
  }
  return { snapshot, busy, error, connection, action }
}
