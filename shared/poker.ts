export const voteValues = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'] as const

export type VoteValue = (typeof voteValues)[number]

export type RoomSnapshot = {
  id: string
  name: string
  revealed: boolean
  finished: boolean
  revision: number
  me: { id: string; name: string; isHost: boolean; vote: VoteValue | null }
  participants: {
    id: string
    name: string
    isHost: boolean
    online: boolean
    hasVoted: boolean
    vote: VoteValue | null
  }[]
  tasks: { id: string; title: string; position: number; status: 'pending' | 'active' | 'completed' }[]
  activeTask: { id: string; title: string; position: number } | null
}

export function voteLabel(value: VoteValue) {
  return value === 'coffee' ? '☕' : value
}
