import { requireTaskPicking, taskPickingSnapshot } from '../../../../../../services/task-picking'
import { requireUser } from '../../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const { projectId, sprintId, user } = await requireTaskPicking(event)
  const stream = createEventStream(event)
  setResponseHeader(event, 'X-Accel-Buffering', 'no')
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let previous = ''
  let heartbeatAt = 0
  stream.onClosed(() => {
    closed = true
    clearTimeout(timer)
  })

  // Match Poker's shared-database SSE snapshots and reconnect behavior.
  async function tick() {
    if (closed) return
    try {
      const heartbeat = Date.now() - heartbeatAt >= 10000
      if (heartbeat) {
        await requireUser(event)
        heartbeatAt = Date.now()
      }
      const snapshot = JSON.stringify(await taskPickingSnapshot(projectId, sprintId, user.id))
      if (closed) return
      if (snapshot !== previous) {
        await stream.push({ event: 'snapshot', data: snapshot })
        previous = snapshot
      } else if (heartbeat) await stream.push({ event: 'heartbeat', data: '{}' })
    } catch {
      if (!closed) await stream.close().catch(() => {})
      return
    }
    if (!closed)
      timer = setTimeout(() => {
        void tick()
      }, 1000)
  }
  timer = setTimeout(() => {
    void tick()
  }, 0)
  return stream.send()
})
