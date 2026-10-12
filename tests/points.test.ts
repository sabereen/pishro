import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cardLabel,
  defaultCards,
  isNumericCard,
  numericVotes,
  pointValues,
} from '../shared/scrum.ts'
import { pointInput } from '../server/utils/validation.ts'

test('zero and half-point are numeric cards and remain distinct from no estimate', () => {
  assert.ok(pointValues.includes(0))
  assert.ok(pointValues.includes(0.5))
  assert.ok(defaultCards.includes('0.5'))
  for (const value of ['0', '0.5', '1', '89']) assert.equal(isNumericCard(value), true)
  for (const value of ['', '?', 'coffee', 'NaN', '-1', '0.25'])
    assert.equal(isNumericCard(value), false)
  assert.equal(cardLabel('0'), '0')
  assert.equal(cardLabel('0.5'), '0.5')
})

test('vote statistics include zero and half-points without integer truncation', () => {
  assert.deepEqual(numericVotes(['0', '0.5', '?', 'coffee']), {
    count: 2,
    average: 0.25,
    median: 0.25,
    low: 0,
    high: 0.5,
    range: 0.5,
    disagreement: false,
  })
  assert.equal(numericVotes(['0.5', '1', '3']).median, 1)
  assert.equal(numericVotes(['0', '0']).count, 2)
  assert.equal(numericVotes(['0', '0']).median, 0)
  assert.equal(numericVotes(['0.5', '0.5']).median, 0.5)
  assert.equal(numericVotes(['?', 'coffee']).median, null)
})

test('server points accept zero and half-point increments and reject invalid values', () => {
  for (const value of [0, 0.5, 1, 1.5, 89, 99.5, 100]) assert.equal(pointInput(value), value)
  Object.assign(globalThis, {
    createError: (details: { message: string }) => new Error(details.message),
  })
  for (const value of [
    -0.5,
    100.5,
    0.1,
    0.25,
    0.500000001,
    NaN,
    Infinity,
    null,
    undefined,
    '0.5',
    {},
    [],
  ])
    assert.throws(() => pointInput(value))
})
