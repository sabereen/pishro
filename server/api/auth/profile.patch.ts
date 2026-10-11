import { eq } from 'drizzle-orm'
import { users } from '../../database/scrum'
import { requireUser } from '../../utils/auth'
import { useDatabase } from '../../utils/database'
import { objectBody, textInput } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = objectBody(await readBody<unknown>(event))
  const name = textInput(body.name, 80)
  await useDatabase().update(users).set({ name }).where(eq(users.id, user.id))
  return { ...user, name }
})
