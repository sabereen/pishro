export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, message: 'درخواست معتبر نیست.' })
  }
  return value as Record<string, unknown>
}

export function textInput(value: unknown, max: number, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw createError({ statusCode: 400, message: 'متن واردشده معتبر نیست یا بیش از حد طولانی است.' })
  }
  return value.trim()
}

export function uuidInput(value: unknown) {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)) {
    throw createError({ statusCode: 400, message: 'شناسه معتبر نیست.' })
  }
  return value
}

export function idList(value: unknown, max = 100) {
  if (!Array.isArray(value) || value.length > max) {
    throw createError({ statusCode: 400, message: 'فهرست انتخاب‌ها معتبر نیست.' })
  }
  return [...new Set(value.map(uuidInput))]
}

export function integerInput(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw createError({ statusCode: 400, message: 'عدد واردشده معتبر نیست.' })
  }
  return value
}

export function enumInput<const T extends readonly string[]>(value: unknown, options: T): T[number] {
  if (typeof value !== 'string' || !options.includes(value)) {
    throw createError({ statusCode: 400, message: 'گزینه انتخاب‌شده معتبر نیست.' })
  }
  return value
}

export function dateInput(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw createError({ statusCode: 400, message: 'تاریخ معتبر نیست.' })
  }
  return value
}

export function passwordInput(value: unknown, minimum = 1) {
  if (typeof value !== 'string' || value.length < minimum || value.length > 128) {
    throw createError({ statusCode: 400, message: `رمز عبور باید بین ${minimum} و ۱۲۸ نویسه باشد.` })
  }
  return value
}
