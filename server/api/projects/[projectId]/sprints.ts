import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { datesBetween, isWorkingDay } from '../../../../shared/calendar'
import { sprints, workItems } from '../../../database/scrum'
import { lockProject, selectedTasks, updateTask } from '../../../services/projects'
import { requireProject } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import {
  dateInput,
  enumInput,
  idList,
  objectBody,
  textInput,
  uuidInput,
} from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event, true)
  const body = objectBody(await readBody<unknown>(event))
  return useDatabase().transaction(async (tx) => {
    const project = await lockProject(tx, projectId, user.id, true)
    if (event.method === 'POST') {
      const name = textInput(body.name, 120)
      const startDate = dateInput(body.startDate)
      const endDate = dateInput(body.endDate)
      if (
        startDate > endDate ||
        new Date(endDate).getTime() - new Date(startDate).getTime() > 366 * 86400000 ||
        !datesBetween(startDate, endDate).some((date) =>
          isWorkingDay(date, project.settings.workingDays),
        )
      ) {
        throw createError({
          statusCode: 400,
          message: 'بازه اسپرینت باید معتبر، کمتر از یک سال و شامل روز کاری باشد.',
        })
      }
      const id = randomUUID()
      await tx.insert(sprints).values({
        id,
        projectId,
        name,
        startDate,
        endDate,
        workingDays: project.settings.workingDays,
      })
      for (const task of await selectedTasks(tx, projectId, idList(body.taskIds ?? [], 2500)))
        await updateTask(tx, task, { sprintId: id }, user.id)
      return { id }
    }
    if (event.method !== 'PATCH')
      throw createError({ statusCode: 405, message: 'عملیات پشتیبانی نمی‌شود.' })
    const id = uuidInput(body.id)
    const action = enumInput(body.action, ['start', 'complete'] as const)
    const [sprint] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, id), eq(sprints.projectId, projectId)))
    if (!sprint) throw createError({ statusCode: 404, message: 'اسپرینت پیدا نشد.' })
    if (action === 'start') {
      const [active] = await tx
        .select({ id: sprints.id })
        .from(sprints)
        .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'active')))
      if (active || sprint.status !== 'planned')
        throw createError({
          statusCode: 409,
          message: 'ابتدا اسپرینت فعال را پایان دهید؛ فقط اسپرینت برنامه‌ریزی‌شده قابل شروع است.',
        })
      const now = new Date()
      await tx.update(sprints).set({ status: 'active', startedAt: now }).where(eq(sprints.id, id))
      await tx.update(workItems).set({ sprintAssignedAt: now }).where(eq(workItems.sprintId, id))
    } else {
      if (sprint.status !== 'active')
        throw createError({ statusCode: 409, message: 'فقط اسپرینت فعال قابل پایان است.' })
      await tx.update(sprints).set({ status: 'completed' }).where(eq(sprints.id, id))
    }
    return { id }
  })
})
