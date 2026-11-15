import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const base = process.env.POKER_SESSIONS_TEST_URL

// Run only against a disposable database with the committed migrations applied.
test('free Poker and live participant management', { skip: !base }, async (t) => {
  const suffix = randomUUID()
  async function request(path, person, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(person ? { cookie: person.cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    }
  }
  async function register(name) {
    const result = await request('/api/auth/register', null, 'POST', {
      name,
      email: `${name}-${suffix}@example.test`,
      password: 'poker-sessions-test-password',
    })
    assert.equal(result.status, 201)
    return { ...result.data, cookie: result.cookie }
  }
  const admin = await register('Facilitator')
  const member = await register('Member')
  const late = await register('Late')
  const stranger = await register('Stranger')
  const created = await request('/api/projects', admin, 'POST', { name: `Poker ${suffix}` })
  assert.equal(created.status, 200)
  const project = `/api/projects/${created.data.id}`
  for (const person of [member, late])
    assert.equal(
      (await request(`${project}/members`, admin, 'POST', { email: person.email })).status,
      200,
    )
  let url
  let snapshot
  async function create(mode = 'free', taskIds = []) {
    const result = await request(`${project}/poker`, admin, 'POST', {
      name: 'جلسه تست',
      mode,
      taskIds,
      participantIds: [member.id],
    })
    assert.equal(result.status, 200, JSON.stringify(result.data))
    url = `${project}/poker/${result.data.id}`
    snapshot = (await request(url, admin)).data
  }
  async function act(action, fields = {}, person = admin, expected = 200) {
    const result = await request(url, person, 'POST', {
      action,
      revision: snapshot.session.revision,
      ...fields,
    })
    assert.equal(result.status, expected, JSON.stringify(result.data))
    if (result.status === 200) snapshot = (await request(url, admin)).data
    return result
  }
  const vote = (value, person = admin) =>
    act('vote', { round: snapshot.freeRound?.round, taskId: snapshot.tasks[0]?.id, value }, person)
  await t.test(
    'free session has no tasks; unrelated members and anonymous users have no access',
    async () => {
      await create()
      assert.equal(snapshot.session.mode, 'free')
      assert.deepEqual(snapshot.tasks, [])
      assert.equal('freeRound' in snapshot.session, false)
      assert.equal((await request(url, late)).status, 403)
      assert.equal((await request(url)).status, 401)
      assert.ok(snapshot.availableMembers.some((person) => person.id === late.id))
      await act('addParticipant', { userId: late.id }, member, 403)
      await act('addParticipant', { userId: stranger.id }, admin, 400)
      await act('removeParticipant', { userId: admin.id }, admin, 400)
    },
  )
  await t.test(
    'late join works in lobby and during voting, hidden votes stay private',
    async () => {
      await act('publish')
      await act('addParticipant', { userId: late.id })
      assert.equal((await request(url, late)).status, 200)
      await act('removeParticipant', { userId: late.id })
      await act('start')
      await vote('0.5')
      const other = (await request(url, member)).data
      assert.equal(other.me.vote, null)
      assert.equal(other.participants.find((person) => person.id === admin.id).hasVoted, true)
      assert.equal(other.participants.find((person) => person.id === admin.id).vote, null)
      assert.deepEqual(other.freeRound.votes, [])
      assert.equal(JSON.stringify(other.session).includes('votes'), false)
      await act('addParticipant', { userId: late.id })
      await vote('1', member)
      assert.equal(snapshot.session.status, 'voting')
      await vote('3', late)
      assert.equal(snapshot.session.status, 'reveal')
      assert.deepEqual(snapshot.freeRound.votes.map((vote) => vote.value).sort(), ['0.5', '1', '3'])
      await act('accept', { point: 3 }, admin, 409)
    },
  )
  await t.test(
    'reset clears all votes, rejects stale rounds and supports repeated concurrent voting',
    async () => {
      const oldRevision = snapshot.session.revision
      const oldRound = snapshot.freeRound.round
      await act('reset')
      assert.equal(snapshot.freeRound.round, oldRound + 1)
      assert.deepEqual(snapshot.freeRound.votes, [])
      assert.ok(snapshot.participants.every((person) => !person.hasVoted))
      await act('vote', { round: oldRound, value: '1' }, member, 409)
      assert.equal(
        (
          await request(url, member, 'POST', {
            action: 'vote',
            revision: oldRevision,
            round: oldRound,
            value: '1',
          })
        ).status,
        409,
      )
      const revision = snapshot.session.revision
      const results = await Promise.all(
        [admin, member, late].map((person) =>
          request(url, person, 'POST', {
            action: 'vote',
            revision,
            round: snapshot.freeRound.round,
            value: '1',
          }),
        ),
      )
      assert.ok(
        results.every((result) => result.status === 200),
        JSON.stringify(results),
      )
      snapshot = (await request(url, admin)).data
      assert.equal(snapshot.session.status, 'reveal')
      await act('reset')
    },
  )
  await t.test(
    'removing a voter drops their current vote and ends an open SSE connection',
    async () => {
      await vote('3', member)
      const controller = new AbortController()
      const stream = await fetch(`${base}${url}/events`, {
        headers: { cookie: member.cookie },
        signal: controller.signal,
      })
      const reader = stream.body.getReader()
      assert.match(new TextDecoder().decode((await reader.read()).value), /event: snapshot/)
      await act('removeParticipant', { userId: member.id })
      assert.equal((await request(url, member)).status, 403)
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SSE revocation timeout')), 5000),
        ),
      ])
      assert.match(new TextDecoder().decode(chunk.value), /event: access-ended/)
      controller.abort()
      assert.equal(
        snapshot.participants.some((person) => person.id === member.id),
        false,
      )
      await vote('1')
      await vote('1', late)
      assert.equal(snapshot.session.status, 'reveal')
      assert.deepEqual(
        snapshot.freeRound.votes.map((vote) => vote.value),
        ['1', '1'],
      )
      assert.ok(
        (await request(project, admin)).data.members.some((person) => person.id === member.id),
      )
    },
  )
  await t.test(
    'removing the last waiting participant reveals; special cards display in free mode',
    async () => {
      await act('reset')
      await vote('?')
      await act('removeParticipant', { userId: late.id })
      assert.equal(snapshot.session.status, 'reveal')
      assert.equal(snapshot.freeRound.votes[0].value, '?')
      await act('addParticipant', { userId: member.id })
      assert.equal(snapshot.session.status, 'reveal')
      await act('reset')
      await vote('coffee')
      await vote('0.5', member)
      assert.equal(snapshot.session.status, 'reveal')
      assert.ok(snapshot.freeRound.votes.some((vote) => vote.value === 'coffee'))
    },
  )
  await t.test(
    'finish clears current votes and makes session read only without changing tasks',
    async () => {
      await act('finish')
      assert.equal(snapshot.session.status, 'finalized')
      assert.equal(snapshot.freeRound, null)
      assert.deepEqual((await request(project, admin)).data.tasks, [])
      await act('reset', {}, admin, 409)
      await act('addParticipant', { userId: late.id }, admin, 409)
    },
  )
  await t.test(
    'task sessions still require tasks; free sessions reject task or sprint selection',
    async () => {
      const task = await request(`${project}/tasks`, admin, 'POST', {
        title: 'Task history',
        point: 3,
      })
      assert.equal(task.status, 200)
      assert.equal(
        (
          await request(`${project}/poker`, admin, 'POST', {
            name: 'Invalid',
            mode: 'tasks',
            taskIds: [],
            participantIds: [],
          })
        ).status,
        400,
      )
      assert.equal(
        (
          await request(`${project}/poker`, admin, 'POST', {
            name: 'Invalid',
            mode: 'free',
            taskIds: [task.data.id],
            participantIds: [],
          })
        ).status,
        400,
      )
      await create('tasks', [task.data.id])
      await act('publish')
      await act('start')
      await vote('1')
      await act('addParticipant', { userId: late.id })
      await vote('3', late)
      await act('removeParticipant', { userId: member.id })
      assert.equal(snapshot.session.status, 'reveal')
      assert.equal(snapshot.tasks[0].votes.length, 2)
      await act('revote', { taskId: snapshot.tasks[0].id })
      assert.equal(snapshot.tasks[0].votes.length, 2)
      await vote('1')
      await vote('3', late)
      await act('accept', { taskId: snapshot.tasks[0].id, point: 2 })
      assert.equal(snapshot.session.status, 'review')
      const history = snapshot.tasks[0].votes
      await act('removeParticipant', { userId: late.id })
      assert.deepEqual(
        snapshot.tasks[0].votes,
        history.map((vote) => (vote.userId === late.id ? { ...vote, name: 'عضو پیشین' } : vote)),
      )
      assert.equal(snapshot.tasks[0].history[0].point, 2)
      await act('finalize')
    },
  )
  await t.test(
    'removing an uncertain voter after reveal updates results and preserves accepted history',
    async () => {
      const task = await request(`${project}/tasks`, admin, 'POST', {
        title: 'Uncertain vote',
        point: 1,
      })
      await create('tasks', [task.data.id])
      await act('publish')
      await act('start')
      await vote('1')
      await vote('?', member)
      assert.equal(snapshot.tasks[0].revoteRequired, true)
      await act('removeParticipant', { userId: member.id })
      assert.equal(snapshot.tasks[0].revoteRequired, false)
      assert.deepEqual(
        snapshot.tasks[0].votes.map((vote) => vote.value),
        ['1'],
      )
      await act('addParticipant', { userId: late.id })
      assert.equal(snapshot.participants.find((person) => person.id === late.id).ignored, true)
      await act('accept', { taskId: snapshot.tasks[0].id, point: 1 })
      assert.deepEqual(
        snapshot.tasks[0].votes.map((vote) => vote.value),
        ['1'],
      )
      await act('removeParticipant', { userId: late.id })
      assert.equal(snapshot.tasks[0].history.length, 1)
      await act('finalize')
    },
  )
  if (process.env.POKER_SESSIONS_BROWSER_FIXTURE) {
    await create()
    await writeFile(
      process.env.POKER_SESSIONS_BROWSER_FIXTURE,
      JSON.stringify({
        project: project.replace('/api', ''),
        url: url.replace('/api', ''),
        admin,
        member,
        late,
      }),
    )
  }
})
