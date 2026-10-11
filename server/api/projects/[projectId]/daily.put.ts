import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { isWorkingDay, todayInTehran } from '../../../../shared/calendar'
import { dailyReports, dailyReportTasks, sprints } from '../../../database/scrum'
import { lockProject, selectedTasks } from '../../../services/projects'
import { requireProject } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { dateInput, idList, objectBody, textInput, uuidInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId, user } = await requireProject(event)
  const body = objectBody(await readBody<unknown>(event))
  const sprintId = uuidInput(body.sprintId)
  const date = dateInput(body.date)
  const yesterday = textInput(body.yesterday, 4000, false)
  const today = textInput(body.today, 4000)
  const blockers = textInput(body.blockers, 4000, false)
  const taskIds = idList(body.taskIds ?? [], 50)
  await useDatabase().transaction(async (tx) => {
    await lockProject(tx, projectId, user.id)
    const [sprint] = await tx.select().from(sprints).where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
    if (!sprint || date < sprint.startDate || date > sprint.endDate || date > todayInTehran() || !isWorkingDay(date, sprint.workingDays)) {
      throw createError({ statusCode: 400, message: 'تاریخ گزارش باید یک روز کاری در بازه اسپرینت و حداکثر امروز باشد.' })
    }
    await selectedTasks(tx, projectId, taskIds)
    const [existing] = await tx.select({ id: dailyReports.id }).from(dailyReports).where(and(eq(dailyReports.sprintId, sprintId), eq(dailyReports.userId, user.id), eq(dailyReports.date, date)))
    const id = existing?.id ?? randomUUID()
    const values = { yesterday, today, blockers, updatedAt: new Date() }
    if (existing) await tx.update(dailyReports).set(values).where(eq(dailyReports.id, id))
    else await tx.insert(dailyReports).values({ id, projectId, sprintId, userId: user.id, date, ...values })
    await tx.delete(dailyReportTasks).where(eq(dailyReportTasks.reportId, id))
    if (taskIds.length) await tx.insert(dailyReportTasks).values(taskIds.map((taskId) => ({ id: randomUUID(), reportId: id, taskId, projectId })))
  })
  return { ok: true }
})
