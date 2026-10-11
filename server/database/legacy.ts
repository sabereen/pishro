import {
  boolean,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'
// Preserve the original prototype tables without exposing their public APIs.
// This keeps upgrades non-destructive for databases that already applied migration 0000.
const voteValues = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'] as const

export const rooms = mysqlTable('rooms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  activePosition: int('active_position', { unsigned: true }).notNull().default(0),
  revealed: boolean('revealed').notNull().default(false),
  finished: boolean('finished').notNull().default(false),
  revision: int('revision', { unsigned: true }).notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const participants = mysqlTable(
  'participants',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    roomId: varchar('room_id', { length: 36 }).notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    isHost: boolean('is_host').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('participants_token_unique').on(table.tokenHash),
    uniqueIndex('participants_id_room_unique').on(table.id, table.roomId),
    index('participants_room_presence_idx').on(table.roomId, table.lastSeenAt),
  ],
)

export const tasks = mysqlTable(
  'tasks',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    roomId: varchar('room_id', { length: 36 }).notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 240 }).notNull(),
    position: int('position', { unsigned: true }).notNull(),
  },
  (table) => [
    uniqueIndex('tasks_room_position_unique').on(table.roomId, table.position),
    uniqueIndex('tasks_id_room_unique').on(table.id, table.roomId),
  ],
)

export const votes = mysqlTable(
  'votes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    roomId: varchar('room_id', { length: 36 }).notNull(),
    taskId: varchar('task_id', { length: 36 }).notNull(),
    participantId: varchar('participant_id', { length: 36 }).notNull(),
    value: mysqlEnum('value', voteValues).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('votes_task_participant_unique').on(table.taskId, table.participantId),
    index('votes_task_room_idx').on(table.taskId, table.roomId),
    index('votes_participant_room_idx').on(table.participantId, table.roomId),
    foreignKey({
      columns: [table.taskId, table.roomId],
      foreignColumns: [tasks.id, tasks.roomId],
      name: 'votes_task_room_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.participantId, table.roomId],
      foreignColumns: [participants.id, participants.roomId],
      name: 'votes_participant_room_fk',
    }).onDelete('cascade'),
  ],
)
