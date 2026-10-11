import { desc, eq } from 'drizzle-orm'
import { projectMembers, projects } from '../../database/scrum'
import { requireUser } from '../../utils/auth'
import { useDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return useDatabase().select({ id: projects.id, name: projects.name, role: projectMembers.role })
    .from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id)).orderBy(desc(projects.createdAt))
})
