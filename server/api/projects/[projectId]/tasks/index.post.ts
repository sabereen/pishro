import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { workItems } from '../../../../database/scrum'
import { lockProject, taskPatch, updateTask } from '../../../../services/projects'
import { requireProject } from '../../../../utils/auth'
import { useDatabase } from '../../../../utils/database'
import { objectBody, textInput } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const body = objectBody(await readBody<unknown>(event))
  const title = textInput(body.title, 240)
  const patch = taskPatch(body)
  const id = randomUUID()
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id)
    const [last] = await tx.select({ rank: workItems.rank }).from(workItems).where(eq(workItems.projectId, projectId)).orderBy(desc(workItems.rank)).limit(1)
    const rows = await tx.select({ id: workItems.id }).from(workItems).where(eq(workItems.projectId, projectId))
    if (rows.length >= 2500) throw createError({ statusCode: 409, message: 'ظرفیت کارهای پروژه تکمیل شده است.' })
    await tx.insert(workItems).values({ id, projectId, title, description: '', rank: (last?.rank ?? 0) + 1 })
    const [task] = await tx.select().from(workItems).where(eq(workItems.id, id))
    if (task) await updateTask(tx, task, patch)
  })
  return { id }
})
