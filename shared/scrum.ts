export const taskStatuses = ['todo', 'in_progress', 'review', 'done'] as const
export const priorities = ['low', 'normal', 'high'] as const
export const pokerStates = ['draft', 'lobby', 'voting', 'reveal', 'review', 'finalized'] as const
export const pointValues = [0, 0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const
export const defaultCards = ['0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee']
export const statusLabels = { todo: 'برای انجام', in_progress: 'در حال انجام', review: 'بازبینی', done: 'انجام شده' }
export const pokerLabels = { draft: 'پیش‌نویس', lobby: 'لابی', voting: 'رأی‌گیری', reveal: 'گفت‌وگو', review: 'بازبینی تخمین‌ها', finalized: 'نهایی شده' }
export type TaskStatus = (typeof taskStatuses)[number]
export type ProjectSettings = { duration: number; workingDays: number[]; cards: string[]; repository: string }
export type PublicUser = { id: string; name: string; email: string; avatarUrl: string }
export type SprintMetrics = {
  done: number; total: number; expected: number; delta: number; remaining: number
  added: number; day: number; days: number
  chart: { date: string; expected: number; actual: number }[]
}

export function isNumericCard(value: string): boolean {
  return /^\d+(?:\.5)?$/.test(value)
}

export function numericVotes(values: string[]) {
  const numbers = values.filter(isNumericCard).map(Number).sort((a, b) => a - b)
  const count = numbers.length
  const low = numbers[0] ?? null
  const high = numbers[count - 1] ?? null
  return {
    count,
    average: count ? numbers.reduce((sum, value) => sum + value, 0) / count : null,
    median: count ? ((numbers[Math.floor((count - 1) / 2)] ?? 0) + (numbers[Math.floor(count / 2)] ?? 0)) / 2 : null,
    low, high,
    range: low !== null && high !== null ? high - low : null,
    disagreement: low !== null && high !== null && high - low >= Math.max(3, low),
  }
}

export function cardLabel(value: string) {
  return value === 'coffee' ? '☕' : value
}
