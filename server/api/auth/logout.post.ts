import { eq } from 'drizzle-orm'
import { authSessions } from '../../database/scrum'
import { hashToken } from '../../utils/auth'
import { useDatabase } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'pishro_session')
  if (token) await useDatabase().delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)))
  deleteCookie(event, 'pishro_session', { path: '/' })
  return { ok: true }
})
