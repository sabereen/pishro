import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'

const base = process.env.TASK_PICKING_TEST_URL

// Run against a disposable migrated MySQL database and a running Nuxt server.
test('live sprint task picking', { skip: !base }, async (t) => {
  const suffix = randomUUID()
  async function request(path, cookie, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, {
      method,
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
    const response = await request('/api/auth/register', null, 'POST', {
      name,
      email: `${name}-${suffix}@example.test`,
      password: 'test-password-123',
    })
    assert.equal(response.status, 201)
    const me = await request('/api/auth/me', response.cookie)
    return { cookie: response.cookie, id: me.data.id, name }
  }
  const reza = await register('Reza')
  const sara = await register('Sara')
  const outsider = await register('Outsider')
  const created = await request('/api/projects', reza.cookie, 'POST', { name: `Picking ${suffix}` })
  assert.equal(created.status, 200)
  const project = `/api/projects/${created.data.id}`
  assert.equal(
    (
      await request(`${project}/members`, reza.cookie, 'POST', {
        email: `Sara-${suffix}@example.test`,
      })
    ).status,
    200,
  )
  const sprint = await request(`${project}/sprints`, reza.cookie, 'POST', {
    name: 'Sprint',
    startDate: '2026-10-17',
    endDate: '2026-10-28',
  })
  assert.equal(sprint.status, 200)
  const picking = `${project}/sprints/${sprint.data.id}/picking`
  const tasks = []
  for (const point of [5, 3, 0, null]) {
    const response = await request(`${project}/tasks`, reza.cookie, 'POST', {
      title: `Task ${point}`,
      point,
      sprintId: sprint.data.id,
    })
    assert.equal(response.status, 200)
    tasks.push(response.data.id)
  }
  const snapshot = async (person = reza) => (await request(picking, person.cookie)).data
  const act = (person, taskId, action, revision) =>
    request(picking, person.cookie, 'POST', { taskId, action, revision })
  const totals = (state) => {
    const sum = (items) => items.reduce((total, task) => total + (task.point ?? 0), 0)
    return {
      total: sum(state.tasks),
      picked: sum(state.tasks.filter((task) => task.assigneeId)),
      unpicked: sum(state.tasks.filter((task) => !task.assigneeId)),
      count: state.tasks.filter((task) => !task.assigneeId).length,
    }
  }
  async function connect(person) {
    const controller = new AbortController()
    const response = await fetch(`${base}${picking}/events`, {
      headers: { cookie: person.cookie },
      signal: controller.signal,
    })
    assert.equal(response.status, 200)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    async function until(predicate) {
      const timeout = setTimeout(() => controller.abort(), 10000)
      try {
        for (;;) {
          const boundary = buffer.indexOf('\n\n')
          if (boundary >= 0) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            if (!frame.includes('event: snapshot')) continue
            const line = frame.split('\n').find((line) => line.startsWith('data:'))
            const value = JSON.parse(line.slice(5))
            if (predicate(value)) return value
          } else {
            const result = await reader.read()
            assert.equal(result.done, false, 'SSE ended unexpectedly')
            buffer += decoder.decode(result.value, { stream: true }).replaceAll('\r\n', '\n')
          }
        }
      } finally {
        clearTimeout(timeout)
      }
    }
    return { until, close: () => controller.abort() }
  }
  const streams = await Promise.all([connect(reza), connect(sara)])
  t.after(() => streams.forEach((stream) => stream.close()))
  await Promise.all(streams.map((stream) => stream.until((state) => state.tasks.length === 4)))

  await t.test('concurrent picks have one winner and notify both clients', async () => {
    const results = await Promise.all([
      act(reza, tasks[0], 'pick', 1),
      act(sara, tasks[0], 'pick', 1),
    ])
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409])
    const state = await snapshot()
    const task = state.tasks.find((task) => task.id === tasks[0])
    const winner = task.assigneeId === reza.id ? reza : sara
    assert.match(
      results.find((result) => result.status === 409).data.message,
      new RegExp(winner.name),
    )
    const synchronized = await Promise.all(
      streams.map((stream) =>
        stream.until(
          (state) => state.tasks.find((task) => task.id === tasks[0]).assigneeId === winner.id,
        ),
      ),
    )
    synchronized.forEach((state) =>
      assert.deepEqual(totals(state), { total: 8, picked: 5, unpicked: 3, count: 3 }),
    )
  })
  await t.test(
    'other members cannot release, reassign or move picked work through any edit API',
    async () => {
      const state = await snapshot()
      const task = state.tasks.find((task) => task.id === tasks[0])
      const other = task.assigneeId === reza.id ? sara : reza
      assert.equal((await act(other, task.id, 'release', task.revision)).status, 403)
      for (const body of [{ assigneeId: other.id }, { assigneeId: null }, { sprintId: null }]) {
        assert.equal(
          (await request(`${project}/tasks/${task.id}`, other.cookie, 'PATCH', body)).status,
          403,
        )
        assert.equal(
          (
            await request(`${project}/tasks`, other.cookie, 'PATCH', {
              ids: [tasks[1], task.id],
              patch: body,
            })
          ).status,
          403,
        )
      }
      assert.equal(
        (await snapshot()).tasks.find((task) => task.id === tasks[0]).assigneeId,
        task.assigneeId,
      )
      assert.equal(
        (await snapshot()).tasks.find((task) => task.id === tasks[1]).assigneeId,
        null,
        'bulk failure must roll back earlier updates',
      )
      assert.equal(
        (
          await request(`${project}/tasks`, reza.cookie, 'POST', {
            title: 'Assign to teammate',
            assigneeId: sara.id,
            sprintId: sprint.data.id,
          })
        ).status,
        403,
      )
    },
  )
  await t.test(
    'release broadcasts and stale revisions cannot overwrite subsequent picks',
    async () => {
      const picked = (await snapshot()).tasks.find((task) => task.id === tasks[0])
      const owner = picked.assigneeId === reza.id ? reza : sara
      assert.equal((await act(owner, picked.id, 'release', picked.revision)).status, 200)
      const states = await Promise.all(
        streams.map((stream) =>
          stream.until((state) => !state.tasks.find((task) => task.id === picked.id).assigneeId),
        ),
      )
      states.forEach((state) =>
        assert.deepEqual(totals(state), { total: 8, picked: 0, unpicked: 8, count: 4 }),
      )
      assert.equal((await act(owner, picked.id, 'pick', 1)).status, 409)
      const released = (await snapshot()).tasks.find((task) => task.id === picked.id)
      assert.equal((await act(owner, picked.id, 'pick', released.revision)).status, 200)
      assert.equal((await act(owner, picked.id, 'release', picked.revision)).status, 409)
    },
  )
  await t.test('assignment ignores a forged assignee and points remain correct', async () => {
    const selected = (await snapshot()).tasks.find((task) => task.id === tasks[1])
    assert.equal(
      (
        await request(picking, sara.cookie, 'POST', {
          action: 'pick',
          taskId: selected.id,
          revision: selected.revision,
          assigneeId: reza.id,
        })
      ).status,
      200,
    )
    assert.equal(
      (await snapshot()).tasks.find((task) => task.id === selected.id).assigneeId,
      sara.id,
    )
    assert.deepEqual(totals(await snapshot()), { total: 8, picked: 8, unpicked: 0, count: 2 })
  })
  await t.test('point edits are reflected in both live summaries', async () => {
    assert.equal(
      (await request(`${project}/tasks/${tasks[1]}`, reza.cookie, 'PATCH', { point: 8 })).status,
      200,
    )
    const states = await Promise.all(
      streams.map((stream) =>
        stream.until((state) => state.tasks.find((task) => task.id === tasks[1]).point === 8),
      ),
    )
    states.forEach((state) =>
      assert.deepEqual(totals(state), { total: 13, picked: 13, unpicked: 0, count: 2 }),
    )
  })
  await t.test('authentication and project/sprint scope are enforced', async () => {
    assert.equal((await request(picking)).status, 401)
    assert.equal((await request(picking, outsider.cookie)).status, 403)
    assert.equal((await act(outsider, tasks[2], 'pick', 1)).status, 403)
    const outside = await request(`${project}/tasks`, reza.cookie, 'POST', {
      title: 'Outside sprint',
    })
    assert.equal((await act(reza, outside.data.id, 'pick', 1)).status, 404)
  })
  await t.test('start permits unpicked work, closes picking and synchronizes clients', async () => {
    assert.equal(
      (
        await request(`${project}/sprints`, sara.cookie, 'PATCH', {
          id: sprint.data.id,
          action: 'start',
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await request(`${project}/sprints`, reza.cookie, 'PATCH', {
          id: sprint.data.id,
          action: 'start',
        })
      ).status,
      200,
    )
    await Promise.all(
      streams.map((stream) => stream.until((state) => state.sprint.status === 'active')),
    )
    assert.equal((await act(reza, tasks[2], 'pick', 1)).status, 409)
    assert.equal((await snapshot()).tasks.filter((task) => !task.assigneeId).length, 2)
  })
})
