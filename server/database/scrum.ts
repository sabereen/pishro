import { sql } from 'drizzle-orm'
import { date, foreignKey, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core'
import { pokerStates, priorities, taskStatuses } from '../../shared/scrum'
import type { ProjectSettings } from '../../shared/scrum'

const id = () => varchar('id', { length: 36 }).primaryKey()
const createdAt = () => timestamp('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`)

export const users = mysqlTable('users', {
  id: id(), name: varchar('name', { length: 80 }).notNull(),
  email: varchar('email', { length: 254 }).notNull(), passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('users_email_unique').on(table.email)])

export const authSessions = mysqlTable('auth_sessions', {
  id: id(), userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(), expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
}, (table) => [uniqueIndex('auth_session_token_unique').on(table.tokenHash), index('auth_session_expiry_idx').on(table.expiresAt)])

export const projects = mysqlTable('projects', {
  id: id(), name: varchar('name', { length: 120 }).notNull(),
  settings: json('settings').$type<ProjectSettings>().notNull(), createdAt: createdAt(),
})

export const projectMembers = mysqlTable('project_members', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  role: mysqlEnum('role', ['admin', 'member']).notNull().default('member'), createdAt: createdAt(),
}, (table) => [
  uniqueIndex('members_project_user_unique').on(table.projectId, table.userId),
  uniqueIndex('members_user_project_unique').on(table.userId, table.projectId),
  index('members_user_idx').on(table.userId),
])

export const projectInvites = mysqlTable('project_invites', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex('invite_token_unique').on(table.tokenHash), index('invites_project_idx').on(table.projectId)])

export const sprints = mysqlTable('sprints', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(), endDate: date('end_date', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', ['planned', 'active', 'completed']).notNull().default('planned'),
  workingDays: json('working_days').$type<number[]>().notNull(),
  startedAt: timestamp('started_at', { mode: 'date', fsp: 3 }),
  activeProjectId: varchar('active_project_id', { length: 36 }).generatedAlwaysAs(sql`case when status = 'active' then project_id else null end`),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('sprints_id_project_unique').on(table.id, table.projectId),
  uniqueIndex('sprints_one_active_unique').on(table.activeProjectId),
  index('sprints_project_status_idx').on(table.projectId, table.status),
])

export const workItems = mysqlTable('work_items', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sprintId: varchar('sprint_id', { length: 36 }), assigneeId: varchar('assignee_id', { length: 36 }),
  title: varchar('title', { length: 240 }).notNull(), description: text('description').notNull(),
  point: int('point', { unsigned: true }), status: mysqlEnum('status', taskStatuses).notNull().default('todo'),
  priority: mysqlEnum('priority', priorities).notNull().default('normal'), rank: int('rank').notNull(),
  sprintAssignedAt: timestamp('sprint_assigned_at', { mode: 'date', fsp: 3 }),
  doneAt: timestamp('done_at', { mode: 'date' }), createdAt: createdAt(),
  revision: int('revision', { unsigned: true }).notNull().default(0),
  updatedAt: timestamp('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
}, (table) => [
  uniqueIndex('work_items_id_project_unique').on(table.id, table.projectId),
  index('work_items_backlog_idx').on(table.projectId, table.rank),
  index('work_items_sprint_status_idx').on(table.sprintId, table.status),
  index('work_items_assignee_idx').on(table.assigneeId, table.projectId),
  foreignKey({ columns: [table.sprintId, table.projectId], foreignColumns: [sprints.id, sprints.projectId], name: 'work_items_sprint_project_fk' }),
  foreignKey({ columns: [table.assigneeId, table.projectId], foreignColumns: [projectMembers.userId, projectMembers.projectId], name: 'work_items_member_project_fk' }),
])

export const sprintPointEvents = mysqlTable('sprint_point_events', {
  id: id(), sprintId: varchar('sprint_id', { length: 36 }).notNull().references(() => sprints.id, { onDelete: 'cascade' }),
  taskId: varchar('task_id', { length: 36 }).references(() => workItems.id, { onDelete: 'set null' }),
  delta: int('delta').notNull(), occurredAt: timestamp('occurred_at', { mode: 'date', fsp: 3 }).notNull(),
}, (table) => [index('sprint_events_time_idx').on(table.sprintId, table.occurredAt)])

export const dailyReports = mysqlTable('daily_reports', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull(),
  sprintId: varchar('sprint_id', { length: 36 }).notNull(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  date: date('date', { mode: 'string' }).notNull(), yesterday: text('yesterday').notNull(),
  today: text('today').notNull(), blockers: text('blockers').notNull(), updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, (table) => [
  uniqueIndex('daily_sprint_user_date_unique').on(table.sprintId, table.userId, table.date),
  foreignKey({ columns: [table.sprintId, table.projectId], foreignColumns: [sprints.id, sprints.projectId], name: 'daily_sprint_project_fk' }).onDelete('cascade'),
  uniqueIndex('daily_id_project_unique').on(table.id, table.projectId),
])

export const dailyReportTasks = mysqlTable('daily_report_tasks', {
  id: id(), reportId: varchar('report_id', { length: 36 }).notNull(),
  taskId: varchar('task_id', { length: 36 }).notNull(), projectId: varchar('project_id', { length: 36 }).notNull(),
}, (table) => [
  uniqueIndex('daily_task_unique').on(table.reportId, table.taskId),
  foreignKey({ columns: [table.reportId, table.projectId], foreignColumns: [dailyReports.id, dailyReports.projectId], name: 'daily_tasks_report_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.taskId, table.projectId], foreignColumns: [workItems.id, workItems.projectId], name: 'daily_tasks_work_item_fk' }).onDelete('cascade'),
])

export const pullRequests = mysqlTable('pull_requests', {
  id: id(), taskId: varchar('task_id', { length: 36 }).notNull().references(() => workItems.id, { onDelete: 'cascade' }),
  repository: varchar('repository', { length: 220 }).notNull(), number: int('number', { unsigned: true }).notNull(),
  title: varchar('title', { length: 500 }).notNull(), url: varchar('url', { length: 500 }).notNull(),
  status: mysqlEnum('status', ['open', 'draft', 'closed', 'merged']).notNull(), fetchedAt: timestamp('fetched_at', { mode: 'date' }).notNull(),
}, (table) => [uniqueIndex('pull_request_task_url_unique').on(table.taskId, table.url)])

export const pokerSessions = mysqlTable('poker_sessions', {
  id: id(), projectId: varchar('project_id', { length: 36 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sprintId: varchar('sprint_id', { length: 36 }), name: varchar('name', { length: 120 }).notNull(),
  facilitatorId: varchar('facilitator_id', { length: 36 }).notNull().references(() => users.id),
  status: mysqlEnum('status', pokerStates).notNull().default('draft'),
  activePosition: int('active_position', { unsigned: true }).notNull().default(0),
  revision: int('revision', { unsigned: true }).notNull().default(0), cards: json('cards').$type<string[]>().notNull(), createdAt: createdAt(),
}, (table) => [
  index('poker_project_status_idx').on(table.projectId, table.status),
  foreignKey({ columns: [table.sprintId, table.projectId], foreignColumns: [sprints.id, sprints.projectId], name: 'poker_sprint_project_fk' }),
  uniqueIndex('poker_session_id_project_unique').on(table.id, table.projectId),
])

export const pokerParticipants = mysqlTable('poker_participants', {
  id: id(), sessionId: varchar('session_id', { length: 36 }).notNull().references(() => pokerSessions.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  joinedAt: timestamp('joined_at', { mode: 'date' }), lastSeenAt: timestamp('last_seen_at', { mode: 'date' }),
}, (table) => [uniqueIndex('poker_participant_unique').on(table.sessionId, table.userId)])

export const pokerSessionTasks = mysqlTable('poker_session_tasks', {
  id: id(), sessionId: varchar('session_id', { length: 36 }).notNull(),
  projectId: varchar('project_id', { length: 36 }).notNull(), taskId: varchar('task_id', { length: 36 }).notNull(),
  position: int('position', { unsigned: true }).notNull(),
  status: mysqlEnum('status', ['pending', 'active', 'estimated']).notNull().default('pending'),
  finalPoint: int('final_point', { unsigned: true }), round: int('round', { unsigned: true }).notNull().default(1),
}, (table) => [
  uniqueIndex('poker_task_unique').on(table.sessionId, table.taskId),
  uniqueIndex('poker_task_position_unique').on(table.sessionId, table.position),
  foreignKey({ columns: [table.sessionId, table.projectId], foreignColumns: [pokerSessions.id, pokerSessions.projectId], name: 'poker_task_session_project_fk' }).onDelete('cascade'),
  foreignKey({ columns: [table.taskId, table.projectId], foreignColumns: [workItems.id, workItems.projectId], name: 'poker_task_work_item_fk' }),
])

export const pokerVotes = mysqlTable('poker_votes', {
  id: id(), sessionTaskId: varchar('session_task_id', { length: 36 }).notNull().references(() => pokerSessionTasks.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  round: int('round', { unsigned: true }).notNull(), value: varchar('value', { length: 10 }).notNull(),
}, (table) => [uniqueIndex('poker_vote_round_user_unique').on(table.sessionTaskId, table.round, table.userId)])

export const estimateHistory = mysqlTable('estimate_history', {
  id: id(), sessionTaskId: varchar('session_task_id', { length: 36 }).notNull().references(() => pokerSessionTasks.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  previousPoint: int('previous_point', { unsigned: true }), point: int('point', { unsigned: true }).notNull(),
  reason: mysqlEnum('reason', ['accepted', 'calibrated']).notNull(), createdAt: createdAt(),
}, (table) => [index('estimate_history_task_idx').on(table.sessionTaskId, table.createdAt)])
