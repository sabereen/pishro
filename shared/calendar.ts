export function todayInTehran() {
  return dateInTehran(new Date())
}

export function dateInTehran(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function datesBetween(start: string, end: string) {
  const result: string[] = []
  const date = new Date(`${start}T12:00:00Z`)
  for (let day = 0; day < 367 && date.toISOString().slice(0, 10) <= end; day++) {
    result.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return result
}

export function isWorkingDay(date: string, days: number[]) {
  return days.includes(new Date(`${date}T12:00:00Z`).getUTCDay())
}

export function persianDate(date: string, short = false) {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', day: 'numeric', month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' as const }),
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date))
}
