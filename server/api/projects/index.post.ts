import { randomUUID } from 'node:crypto'
import { defaultCards } from '../../../shared/scrum'
import { projectMembers, projects } from '../../database/scrum'
import { requireUser } from '../../utils/auth'
import { useDatabase } from '../../utils/database'
import { objectBody, textInput } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = objectBody(await readBody<unknown>(event))
  const name = textInput(body.name, 120)
  const id = randomUUID()
  await useDatabase().transaction(async (tx) => {
    await tx.insert(projects).values({ id, name, settings: { duration: 10, workingDays: [6, 0, 1, 2, 3], cards: defaultCards, repository: '' } })
    await tx.insert(projectMembers).values({ id: randomUUID(), projectId: id, userId: user.id, role: 'admin' })
  })
  return { id }
})
