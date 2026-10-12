import type { InferSelectModel } from 'drizzle-orm'
import type * as schema from '../server/database/scrum'
import type { PublicUser, SprintMetrics } from './scrum'

export type JsonValue<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? JsonValue<U>[]
    : T extends object
      ? { [K in keyof T]: JsonValue<T[K]> }
      : T
export type Sprint = JsonValue<InferSelectModel<typeof schema.sprints>>
export type PullRequest = JsonValue<InferSelectModel<typeof schema.pullRequests>>
export type Task = JsonValue<InferSelectModel<typeof schema.workItems>> & {
  pullRequests: PullRequest[]
}
export type Member = PublicUser & { role: 'admin' | 'member' }
export type TaskPickingSnapshot = {
  sprint: Sprint
  me: { id: string; admin: boolean }
  members: Pick<Member, 'id' | 'name' | 'avatarUrl'>[]
  tasks: Pick<Task, 'id' | 'title' | 'point' | 'assigneeId' | 'revision'>[]
}
export type ProjectOverview = {
  project: JsonValue<InferSelectModel<typeof schema.projects>>
  role: 'admin' | 'member'
  members: Member[]
  sprints: Sprint[]
  tasks: Task[]
  metrics: Record<string, SprintMetrics>
}
export type DailyReport = JsonValue<InferSelectModel<typeof schema.dailyReports>> & {
  taskIds: string[]
  authorName: string
  authorAvatarUrl: string
}
export type PokerSession = JsonValue<InferSelectModel<typeof schema.pokerSessions>>
export type PokerSnapshot = {
  session: PokerSession
  me: { id: string; facilitator: boolean; vote: string | null }
  participants: {
    id: string
    name: string
    avatarUrl: string
    joined: boolean
    online: boolean
    ignored: boolean
    hasVoted: boolean
    vote: string | null
  }[]
  tasks: {
    id: string
    taskId: string
    title: string
    position: number
    status: 'pending' | 'active' | 'estimated'
    finalPoint: number | null
    round: number
    ignoredUserIds: string[]
    revoteRequired: boolean
    votes: { userId: string; name: string; value: string; round: number }[]
    history: { point: number; previousPoint: number | null; reason: string; date: string }[]
  }[]
}
