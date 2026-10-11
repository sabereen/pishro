import { projectOverview } from '../../../services/projects'
import { requireProject } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const { projectId, membership } = await requireProject(event)
  return projectOverview(projectId, membership.role)
})
