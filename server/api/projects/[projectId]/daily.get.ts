import { and, eq, inArray } from 'drizzle-orm'
import { dailyReports, dailyReportTasks, sprints, users } from '../../../database/scrum'
import { gravatarUrl } from '../../../utils/avatar'
import { requireProject } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { jsonValue } from '../../../utils/json'
import { uuidInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { projectId } = await requireProject(event)
  const sprintId = uuidInput(getQuery(event).sprintId)
  const db = useDatabase()
  const [sprint] = await db.select({ id: sprints.id }).from(sprints).where(and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId)))
  if (!sprint) throw createError({ statusCode: 404, message: 'اسپرینت پیدا نشد.' })
  const reports = await db.select({ report: dailyReports, authorName: users.name, authorEmail: users.email }).from(dailyReports)
    .innerJoin(users, eq(dailyReports.userId, users.id)).where(eq(dailyReports.sprintId, sprintId))
  const links = reports.length ? await db.select().from(dailyReportTasks).where(inArray(dailyReportTasks.reportId, reports.map(({ report }) => report.id))) : []
  return jsonValue(reports).map(({ report, authorName, authorEmail }) => ({ ...report, authorName, authorAvatarUrl: gravatarUrl(authorEmail), taskIds: links.filter((link) => link.reportId === report.id).map((link) => link.taskId) }))
})
