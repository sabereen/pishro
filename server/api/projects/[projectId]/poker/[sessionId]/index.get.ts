import { pokerSnapshot, requirePoker } from '../../../../../services/planning'

export default defineEventHandler(async (event) => {
  const context = await requirePoker(event)
  return pokerSnapshot(context.sessionId, context.user.id)
})
