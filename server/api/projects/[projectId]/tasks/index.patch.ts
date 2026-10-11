import { eq } from 'drizzle-orm'
import { workItems } from '../../../../database/scrum'
import { lockProject, selectedTasks, taskPatch, updateTask } from '../../../../services/projects'
import { requireProject } from '../../../../utils/auth'
import { useDatabase } from '../../../../utils/database'
import { idList, objectBody } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const body = objectBody(await readBody<unknown>(event))
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id)
    if (body.order) {
      const ids = idList(body.order, 2500)
      const all = await tx
        .select({ id: workItems.id })
        .from(workItems)
        .where(eq(workItems.projectId, projectId))
      if (all.length !== ids.length || all.some((task) => !ids.includes(task.id))) {
        throw createError({
          statusCode: 409,
          message: 'فهرست کارها تغییر کرده است؛ دوباره تلاش کنید.',
        })
      }
      for (const [rank, id] of ids.entries())
        await tx.update(workItems).set({ rank }).where(eq(workItems.id, id))
    } else {
      const ids = idList(body.ids, 2500)
      const patch = taskPatch(objectBody(body.patch))
      for (const task of await selectedTasks(tx, projectId, ids))
        await updateTask(tx, task, patch, user.id)
    }
  })
  return { ok: true }
})
