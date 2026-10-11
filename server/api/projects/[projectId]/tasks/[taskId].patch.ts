import { lockProject, selectedTasks, taskPatch, updateTask } from '../../../../services/projects'
import { requireProject } from '../../../../utils/auth'
import { useDatabase } from '../../../../utils/database'
import { integerInput, objectBody, uuidInput } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const id = uuidInput(getRouterParam(event, 'taskId'))
  const body = objectBody(await readBody<unknown>(event))
  const patch = taskPatch(body)
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id)
    const [task] = await selectedTasks(tx, projectId, [id])
    if (task) {
      if ('revision' in body && integerInput(body.revision, 0, 2147483647) !== task.revision) {
        throw createError({
          statusCode: 409,
          message: 'این کار توسط هم‌تیمی شما تغییر کرده است؛ جزئیات را دوباره باز کنید.',
        })
      }
      await updateTask(tx, task, patch, user.id)
    }
  })
  return { ok: true }
})
