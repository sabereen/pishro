import { eq } from 'drizzle-orm'
import { gravatarUrl } from '../../utils/avatar'
import { users } from '../../database/scrum'
import { checkPassword, passwordHash, startSession } from '../../utils/auth'
import { useDatabase } from '../../utils/database'
import { objectBody, passwordInput, textInput } from '../../utils/validation'

const attempts = new Map<string, { count: number; until: number }>()

export default defineEventHandler(async (event) => {
  const body = objectBody(await readBody<unknown>(event))
  const email = textInput(body.email, 254).toLowerCase()
  const password = passwordInput(body.password)
  const key = `${getRequestIP(event) ?? 'unknown'}:${email}`
  const attempt = attempts.get(key)
  if (attempt && attempt.until > Date.now() && attempt.count >= 10) {
    throw createError({ statusCode: 429, message: 'تلاش‌های زیادی انجام شده است؛ ۱۵ دقیقه بعد دوباره امتحان کنید.' })
  }
  if (attempts.size > 10000) {
    for (const [entry, value] of attempts) if (value.until < Date.now()) attempts.delete(entry)
    if (attempts.size > 10000 && !attempts.has(key)) throw createError({ statusCode: 429, message: 'کمی بعد دوباره تلاش کنید.' })
  }
  attempts.set(key, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 900000 })
  const [user] = await useDatabase().select().from(users).where(eq(users.email, email)).limit(1)
  let valid = false
  if (user) valid = await checkPassword(password, user.passwordHash)
  else await passwordHash(password)
  if (!user || !valid) throw createError({ statusCode: 401, message: 'ایمیل یا رمز عبور درست نیست.' })
  attempts.delete(key)
  await startSession(event, user.id)
  return { id: user.id, name: user.name, email: user.email, avatarUrl: gravatarUrl(user.email) }
})
