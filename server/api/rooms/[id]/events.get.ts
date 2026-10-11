import { eq } from 'drizzle-orm'
import { participants } from '../../../database/schema'
import { getRoomSnapshot } from '../../../services/poker'
import { useDatabase } from '../../../utils/database'
import { requireParticipant, roomIdFromEvent } from '../../../utils/identity'

export default defineEventHandler(async (event) => {
  const roomId = roomIdFromEvent(event)
  const participant = await requireParticipant(event, roomId)
  const db = useDatabase()
  const stream = createEventStream(event)
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let previous = ''
  let lastHeartbeat = 0

  stream.onClosed(() => {
    closed = true
    clearTimeout(timer)
  })

  async function tick() {
    if (closed) return
    try {
      const heartbeat = Date.now() - lastHeartbeat >= 10000
      if (heartbeat) {
        await db.update(participants).set({ lastSeenAt: new Date() }).where(eq(participants.id, participant.id))
        lastHeartbeat = Date.now()
      }
      const snapshot = JSON.stringify(await getRoomSnapshot(roomId, participant.id))
      if (closed) return
      if (snapshot !== previous) {
        await stream.push({ event: 'snapshot', data: snapshot })
        previous = snapshot
      } else if (heartbeat) {
        await stream.push({ event: 'heartbeat', data: '{}' })
      }
    } catch {
      if (!closed) {
        await stream.close().catch(() => {})
      }
      return
    }
    if (!closed) timer = setTimeout(() => { void tick() }, 1000)
  }

  // Poll shared MySQL state so SSE works across processes without a message broker.
  timer = setTimeout(() => { void tick() }, 0)
  return stream.send()
})
