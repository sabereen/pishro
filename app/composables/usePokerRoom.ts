import type { RoomSnapshot, VoteValue } from '../../shared/poker'

export function usePokerRoom(id: string, initial: RoomSnapshot | null) {
  const room = ref(initial)
  const busy = ref(false)
  const error = ref('')
  const connection = ref<'connecting' | 'connected' | 'reconnecting'>('connecting')
  let stream: EventSource | undefined
  let mounted = false
  let disposed = false

  function connect() {
    if (!mounted || disposed || !room.value || stream) return
    stream = new EventSource(`/api/rooms/${id}/events`)
    stream.onopen = () => { connection.value = 'connected' }
    stream.onerror = () => { connection.value = 'reconnecting' }
    stream.addEventListener('snapshot', (event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return
      // Do not let an in-flight stream frame overwrite a pending action response.
      if (!busy.value) room.value = JSON.parse(event.data) as RoomSnapshot
    })
  }

  onMounted(() => { mounted = true; connect() })
  onScopeDispose(() => { disposed = true; stream?.close() })

  async function mutate(action: () => Promise<RoomSnapshot>) {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const snapshot = await action()
      if (!disposed) room.value = snapshot
      return true
    } catch (cause) {
      error.value = requestError(cause)
      return false
    } finally {
      busy.value = false
      // Reconnect for an authoritative snapshot after any concurrent round changes.
      stream?.close()
      stream = undefined
      connect()
    }
  }

  function join(name: string) {
    return mutate(() => $fetch(`/api/rooms/${id}/join`, { method: 'POST', body: { name } }))
  }

  function vote(value: VoteValue) {
    const taskId = room.value?.activeTask?.id
    if (!taskId) return Promise.resolve(false)
    const revision = room.value?.revision
    return mutate(() => $fetch(`/api/rooms/${id}/vote`, { method: 'PUT', body: { taskId, value, revision } }))
  }

  function round(action: 'reveal' | 'reset' | 'next') {
    const taskId = room.value?.activeTask?.id
    if (!taskId) return Promise.resolve(false)
    const revision = room.value?.revision
    return mutate(() => $fetch(`/api/rooms/${id}/round`, { method: 'POST', body: { taskId, action, revision } }))
  }

  function addTask(title: string) {
    return mutate(() => $fetch(`/api/rooms/${id}/tasks`, { method: 'POST', body: { title } }))
  }

  return { room, busy, error, connection, join, vote, round, addTask }
}
