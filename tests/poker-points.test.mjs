import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const base = process.env.POKER_POINTS_TEST_URL

// Use only a disposable migrated MySQL database and a running Nuxt server.
test('Poker zero and fractional points', { skip: !base }, async (t) => {
  const suffix = randomUUID()
  async function request(path, cookie, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(cookie ? { cookie } : {}),
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
    const email = `${name}-${suffix}@example.test`
    const response = await request('/api/auth/register', null, 'POST', {
      name,
      email,
      password: 'points-test-password',
    })
    assert.equal(response.status, 201)
    return { ...response.data, cookie: response.cookie }
  }
  const admin = await register('Admin')
  const member = await register('Member')
  const created = await request('/api/projects', admin.cookie, 'POST', { name: `Points ${suffix}` })
  assert.equal(created.status, 200)
  const project = `/api/projects/${created.data.id}`
  assert.equal(
    (await request(`${project}/members`, admin.cookie, 'POST', { email: member.email })).status,
    200,
  )
  const sprint = await request(`${project}/sprints`, admin.cookie, 'POST', {
    name: 'Points',
    startDate: '2026-10-17',
    endDate: '2026-10-28',
  })
  assert.equal(sprint.status, 200)
  const tasks = []
  for (const point of [1, 0.5]) {
    const task = await request(`${project}/tasks`, admin.cookie, 'POST', {
      title: `Task ${point}`,
      point,
      sprintId: sprint.data.id,
      status: point === 1 ? 'done' : 'todo',
    })
    assert.equal(task.status, 200)
    tasks.push(task.data.id)
  }
  async function settings(cards) {
    const overview = (await request(project, admin.cookie)).data
    const response = await request(project, admin.cookie, 'PATCH', {
      name: overview.project.name,
      settings: { ...overview.project.settings, cards },
    })
    assert.equal(response.status, 200)
    if (session?.url) session.snapshot = (await request(session.url, admin.cookie)).data
  }
  async function draft() {
    const response = await request(`${project}/poker`, admin.cookie, 'POST', {
      name: 'Points session',
      taskIds: tasks,
      participantIds: [member.id],
    })
    assert.equal(response.status, 200)
    const url = `${project}/poker/${response.data.id}`
    return { url, snapshot: (await request(url, admin.cookie)).data }
  }
  let session = await draft()
  assert.ok(session.snapshot.session.cards.includes('0.5'))
  assert.ok(!session.snapshot.session.cards.includes('0'))
  async function act(person, action, fields = {}) {
    const response = await request(session.url, person.cookie, 'POST', {
      action,
      revision: session.snapshot.session.revision,
      ...fields,
    })
    assert.equal(response.status, 200, JSON.stringify(response.data))
    session.snapshot = response.data
    return response.data
  }
  const current = () =>
    session.snapshot.tasks.find((task) => task.position === session.snapshot.session.activePosition)
  await t.test('enabling zero after draft creation refreshes the deck before voting', async () => {
    await settings(['0', '0.5', '1'])
    await act(admin, 'publish')
    await act(admin, 'start')
    assert.deepEqual(session.snapshot.session.cards, ['0', '0.5', '1'])
    assert.equal(session.snapshot.session.status, 'voting')
  })
  await t.test('zero and half-point votes are accepted and zero remains a real vote', async () => {
    const taskId = current().id
    const zero = await act(admin, 'vote', { taskId, value: '0' })
    assert.equal(zero.me.vote, '0')
    assert.equal(zero.participants.find((person) => person.id === admin.id).hasVoted, true)
    await act(member, 'vote', { taskId, value: '0.5' })
    assert.equal(session.snapshot.session.status, 'reveal')
    assert.deepEqual(
      current()
        .votes.map((vote) => vote.value)
        .sort(),
      ['0', '0.5'],
    )
    assert.equal((await request(session.url, admin.cookie)).data.me.vote, '0')
  })
  await t.test(
    'accepting half a point preserves task, history and fractional progress',
    async () => {
      await act(admin, 'accept', { taskId: current().id, point: 0.5 })
      const item = session.snapshot.tasks.find((task) => task.taskId === tasks[0])
      assert.equal(item.finalPoint, 0.5)
      assert.equal(item.history[0].previousPoint, 1)
      assert.equal(item.history[0].point, 0.5)
      const overview = (await request(project, admin.cookie)).data
      assert.equal(overview.tasks.find((task) => task.id === tasks[0]).point, 0.5)
      assert.equal(overview.tasks.find((task) => task.id === tasks[1]).point, 0.5)
      assert.equal(overview.metrics[sprint.data.id].done, 0.5)
      assert.equal(overview.metrics[sprint.data.id].total, 1)
    },
  )
  await t.test('zero can be accepted without becoming null or missing', async () => {
    const taskId = current().id
    await act(admin, 'vote', { taskId, value: '0' })
    await act(member, 'vote', { taskId, value: '0' })
    await act(admin, 'accept', { taskId, point: 0 })
    assert.equal(session.snapshot.session.status, 'review')
    const item = session.snapshot.tasks.find((task) => task.taskId === tasks[1])
    assert.equal(item.finalPoint, 0)
    assert.equal(item.history[0].previousPoint, 0.5)
    assert.equal(item.history[0].point, 0)
    assert.equal(
      (await request(project, admin.cookie)).data.tasks.find((task) => task.id === tasks[1]).point,
      0,
    )
  })
  await t.test('calibration preserves fractional history and progress deltas', async () => {
    const taskId = session.snapshot.tasks.find((task) => task.taskId === tasks[0]).id
    await act(admin, 'calibrate', { taskId, point: 1.5 })
    await act(admin, 'calibrate', { taskId, point: 0.5 })
    const item = session.snapshot.tasks.find((task) => task.id === taskId)
    assert.equal(item.finalPoint, 0.5)
    assert.deepEqual(
      item.history.map((entry) => [entry.previousPoint, entry.point]),
      [
        [1, 0.5],
        [0.5, 1.5],
        [1.5, 0.5],
      ],
    )
    const overview = (await request(project, admin.cookie)).data
    assert.equal(overview.metrics[sprint.data.id].done, 0.5)
    assert.equal(overview.metrics[sprint.data.id].total, 0.5)
  })
  await t.test(
    'half-point alone satisfies the numeric-deck requirement; disabled zero is rejected',
    async () => {
      await settings(['0.5'])
      session = await draft()
      await act(admin, 'publish')
      await act(admin, 'start')
      assert.deepEqual(session.snapshot.session.cards, ['0.5'])
      const invalid = await request(session.url, admin.cookie, 'POST', {
        action: 'vote',
        revision: session.snapshot.session.revision,
        taskId: current().id,
        value: '0',
      })
      assert.equal(invalid.status, 409)
      await act(admin, 'vote', { taskId: current().id, value: '0.5' })
      assert.equal(session.snapshot.me.vote, '0.5')
    },
  )
  await t.test(
    'enabling zero in an active session updates the deck and preserves existing votes',
    async () => {
      const previousRevision = session.snapshot.session.revision
      await settings(['1', '0.5', '0'])
      assert.deepEqual(session.snapshot.session.cards, ['0', '0.5', '1'])
      assert.ok(session.snapshot.session.revision > previousRevision)
      assert.equal(session.snapshot.me.vote, '0.5')
      await act(admin, 'vote', { taskId: current().id, value: '0' })
      assert.equal(session.snapshot.me.vote, '0')
    },
  )
  if (process.env.POKER_POINTS_BROWSER_FIXTURE) {
    await settings(['0', '0.5', '1'])
    session = await draft()
    await act(admin, 'publish')
    await act(admin, 'start')
    await writeFile(
      process.env.POKER_POINTS_BROWSER_FIXTURE,
      JSON.stringify({ url: session.url.replace('/api', ''), cookie: admin.cookie }),
    )
  }
})
