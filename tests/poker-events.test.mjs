import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  publishPokerSession,
  publishProjectPokerSessions,
  subscribePokerSession,
} from '../server/utils/poker-events.ts'

test('Poker notifications are scoped to the project and room', () => {
  const events = []
  const offA = subscribePokerSession('project-a', 'room-1', () => events.push('a1'))
  const offB = subscribePokerSession('project-a', 'room-2', () => events.push('a2'))
  const offC = subscribePokerSession('project-b', 'room-1', () => events.push('b1'))
  try {
    publishPokerSession('project-a', 'room-1')
    assert.deepEqual(events, ['a1'])
    publishProjectPokerSessions('project-a')
    assert.deepEqual(events, ['a1', 'a1', 'a2'])
    publishPokerSession('project-b', 'room-1')
    assert.deepEqual(events, ['a1', 'a1', 'a2', 'b1'])
  } finally {
    offA()
    offB()
    offC()
  }
})

test('unsubscribe releases a listener and is safe to call twice', () => {
  let count = 0
  const off = subscribePokerSession('cleanup', 'room', () => count++)
  publishPokerSession('cleanup', 'room')
  off()
  off()
  publishPokerSession('cleanup', 'room')
  publishProjectPokerSessions('cleanup')
  assert.equal(count, 1)
})

test('one failing subscriber cannot prevent notifications for others', () => {
  let called = false
  const previousError = console.error
  const errors = []
  console.error = (...args) => errors.push(args)
  const fail = subscribePokerSession('errors', 'room', () => {
    throw new Error('listener failed')
  })
  const pass = subscribePokerSession('errors', 'room', () => {
    called = true
  })
  try {
    assert.doesNotThrow(() => publishPokerSession('errors', 'room'))
    assert.equal(called, true)
    assert.equal(errors.length, 1)
  } finally {
    fail()
    pass()
    console.error = previousError
  }
})

test('removing listeners while publishing does not skip subsequent listeners', () => {
  const seen = []
  let offSecond = () => {}
  const offFirst = subscribePokerSession('iteration', 'room', () => {
    seen.push(1)
    offSecond()
  })
  offSecond = subscribePokerSession('iteration', 'room', () => seen.push(2))
  try {
    publishPokerSession('iteration', 'room')
    assert.deepEqual(seen, [1, 2])
    publishPokerSession('iteration', 'room')
    assert.deepEqual(seen, [1, 2, 1])
  } finally {
    offFirst()
    offSecond()
  }
})
