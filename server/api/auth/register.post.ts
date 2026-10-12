import { randomUUID } from 'node:crypto'
import { gravatarUrl } from '../../utils/avatar'
import { users } from '../../database/scrum'
import { passwordHash, startSession } from '../../utils/auth'
import { useDatabase } from '../../utils/database'
import { objectBody, passwordInput, textInput } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = objectBody(await readBody<unknown>(event))
  const name = textInput(body.name, 80)
  const email = textInput(body.email, 254).toLowerCase()
  const password = passwordInput(body.password, 10)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, message: 'ایمیل معتبر و رمز عبور حداقل ۱۰ نویسه‌ای وارد کنید.' })
  }
  const user = { id: randomUUID(), name, email }
  try {
    await useDatabase().insert(users).values({ ...user, passwordHash: await passwordHash(password) })
  } catch (error) {
    const cause = error instanceof Error && 'cause' in error ? error.cause : error
    if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: 'این ایمیل قبلاً ثبت شده است؛ وارد حساب شوید.' })
    }
    throw error
  }
  await startSession(event, user.id)
  setResponseStatus(event, 201)
  return { ...user, avatarUrl: gravatarUrl(user.email) }
})
