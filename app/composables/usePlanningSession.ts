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

  function applySnapshot(incoming: PokerSnapshot) {
    if (disposed || !snapshot.value) return
    if (incoming.session.revision >= snapshot.value.session.revision) snapshot.value = incoming
  }

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
      streamVersion++
      applySnapshot(JSON.parse(event.data) as PokerSnapshot)
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
    if (busy.value || disposed || !snapshot.value) return
    const revision = snapshot.value.session.revision
    await run(async () => {
      const versionBeforeAction = streamVersion
      let result: PokerSnapshot | undefined
      try {
        result = await $fetch<PokerSnapshot>(url, {
          method: 'POST',
          body: { action, revision, ...fields },
        })
        // Votes within a round can share a revision, so an overlapping stream
        // frame and POST response cannot be ordered by revision alone.
        if (streamVersion === versionBeforeAction) applySnapshot(result)
      } finally {
        if (!disposed && snapshot.value && (!result || streamVersion !== versionBeforeAction)) {
          const versionBeforeRefresh = streamVersion
          const latest = await $fetch<PokerSnapshot>(url).catch(() => null)
          if (latest && streamVersion === versionBeforeRefresh) applySnapshot(latest)
        }
      }
    })
  }
  return { snapshot, busy, error, connection, action }
}
