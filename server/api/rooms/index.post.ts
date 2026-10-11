import { randomUUID } from 'node:crypto'
import { participants, rooms, tasks } from '../../database/schema'
import { useDatabase } from '../../utils/database'
import { createIdentity } from '../../utils/identity'
import { readTaskTitles, readText } from '../../utils/input'

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event)
  const name = readText(body, 'name', 120)
  const participantName = readText(body, 'participantName', 60)
  const titles = readTaskTitles(body)
  const id = randomUUID()
  const tokenHash = createIdentity(event, id)

  await useDatabase().transaction(async (tx) => {
    await tx.insert(rooms).values({ id, name })
    await tx.insert(participants).values({
      id: randomUUID(), roomId: id, name: participantName, tokenHash, isHost: true,
    })
    await tx.insert(tasks).values(titles.map((title, position) => ({
      id: randomUUID(), roomId: id, title, position,
    })))
  })
  setResponseStatus(event, 201)
  return { id }
})
