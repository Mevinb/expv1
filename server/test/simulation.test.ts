import { afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { idleInput, type Animal, type Input, type RaceEvent, type Racer } from '../../shared/src/protocol.js'
import { CHECKPOINTS, centerAt, elevationAt, FINISH_Z } from '../../shared/src/track.js'
import { Simulation, initPhysics } from '../src/Simulation.js'

const active: Simulation[] = []
before(initPhysics)
afterEach(() => { for (const sim of active.splice(0)) sim.dispose() })

function race(animals: Animal[] = ['elephant']) {
  const sim = new Simulation()
  active.push(sim)
  animals.forEach((a, index) => sim.add(String(index), a, index))
  return sim
}
function tick(sim: Simulation, count = 1, event: RaceEvent | null = null) {
  for (let i = 0; i < count; i++) sim.step('RACING', event)
}
function control(sim: Simulation, data: Partial<Input>, id = '0') {
  sim.input(id, { ...idleInput(), ...data })
}

test('countdown locks the grid; walking, sprint, jump and low gravity use server movement', () => {
  const a = race(), b = race()
  const start = a.players()[0]
  control(a, { z: 1, sprint: true })
  for (let i = 0; i < 90; i++) a.step('COUNTDOWN', null)
  assert.equal(a.players()[0].z, start.z)
  control(b, { z: 1 })
  tick(a, 90); tick(b, 90)
  assert.ok(a.players()[0].z > b.players()[0].z + 5)
  control(a, { jump: true }); control(b, { jump: true })
  tick(a, 17, 'lowGravity'); tick(b, 17)
  assert.ok(a.players()[0].y > b.players()[0].y + 1)
  tick(a, 90); assert.ok(a.players()[0].grounded)
})

test('simultaneous abilities are bounded, cooldown-locked, and reset cleanly', () => {
  const s = race(['elephant', 'penguin', 'turtle'])
  tick(s, 10)
  for (const id of ['0', '1', '2']) control(s, { ability: true }, id)
  tick(s)
  const [e, p, t] = s.players()
  assert.ok(e.vz > 8)
  assert.ok(p.vx > 0, 'gas pushes the neighboring penguin')
  // A startled neighbour can be briefly stunned. Trigger on a free tick.
  for (const r of [p, t]) if (!r.active) {
    control(s, {}, r.id); tick(s, 16); control(s, { ability: true }, r.id); tick(s)
  }
  for (const r of s.players()) assert.ok(r.stats.abilities === 1 && r.cooldown > 0)
  tick(s, 40)
  for (const id of ['0', '1', '2']) { control(s, {}, id); control(s, { ability: true }, id) }
  tick(s)
  assert.ok(s.players().every(r => r.stats.abilities === 1))
  s.reset()
  assert.ok(s.players().every(r => r.cooldown === 0 && r.stats.abilities === 0 && !r.active))
})

test('gorilla grab is range-limited, escapeable and throws toward the camera', () => {
  const s = race(['gorilla', 'penguin'])
  tick(s, 4)
  control(s, { interact: true }); tick(s, 18)
  assert.ok(s.players()[1].y > s.players()[0].y + 1)
  control(s, { ability: true, yaw: Math.PI / 2 }); tick(s)
  assert.equal(s.players()[0].stats.throws, 1)
  assert.ok(s.players()[1].vx > 10 && s.players()[1].vy > 4)
  s.reset(); tick(s, 4); control(s, { interact: true }); tick(s, 18)
  control(s, { jump: true }, '1'); tick(s)
  control(s, { ability: true }); tick(s)
  assert.equal(s.players()[0].stats.throws, 0)
  s.remove('1'); s.reset()
  control(s, { interact: true }); tick(s)
  assert.equal(s.players()[0].stats.abilities, 0)
})

test('falling restores the last checkpoint and invalid controls cannot replace movement', () => {
  const s = race()
  control(s, { x: 1, sprint: true })
  s.input('0', { ...idleInput(), x: NaN })
  for (let i = 0; i < 200 && s.players()[0].stats.falls === 0; i++) tick(s)
  const player = s.players()[0]
  assert.equal(player.stats.falls, 1)
  assert.equal(player.z, 0)
  assert.equal(player.checkpoint, 0)
  assert.equal(player.finishTime, null)
})

/** Steer along the visible right-hand banana lane and left side of the late obstacles.
 * Uses only the public control API to exercise crossings and all terrain colliders. */
function followCourse(s: Simulation, p: Racer, offset = 0) {
  const lookAhead = p.z + 5
  let lane = 8.7
  if (lookAhead < 205) lane = 8.8
  else if (lookAhead < 438) lane = -8.5
  else if (lookAhead < 670) lane = 0
  else if (lookAhead < 921) lane = -10.3
  else if (lookAhead < 1200) lane = 9
  const targetX = centerAt(lookAhead) + lane + offset
  control(s, { x: Math.max(-1, Math.min(1, (p.x - targetX) / 3)), z: 1, sprint: true }, p.id)
}

for (const animal of ['elephant', 'penguin', 'gorilla', 'turtle'] as const) {
  test(animal + ' can complete the six-zone course using normal controls', () => {
    const s = race([animal])
    const crossed = new Set<number>()
    for (let i = 0; i < 7200; i++) {
      const p = s.players()[0]
      crossed.add(p.checkpoint)
      if (p.finishTime !== null) break
      followCourse(s, p)
      tick(s)
    }
    const finish = s.players()[0]
    assert.ok(finish.finishTime !== null, 'Stopped at ' + JSON.stringify(finish))
    assert.ok(finish.z >= FINISH_Z)
    assert.ok(Math.abs(finish.y - elevationAt(FINISH_Z)) < 4)
    assert.equal(crossed.size, CHECKPOINTS.length + 1)
    assert.ok(finish.finishTime > 90 && finish.finishTime < 235)
  })
}

test('gates accept only forward crossings of the next physical opening', async () => {
  const { gateCrossing } = await import('../src/checkpoints.js')
  const gate = CHECKPOINTS[0]
  const onTrack = { x: centerAt(gate), y: elevationAt(gate) + 0.84 }
  const before = { ...onTrack, z: gate - 0.2 }
  const after = { ...onTrack, z: gate + 0.8 }
  assert.ok(Math.abs(gateCrossing(0, before, after)! - 0.2) < 0.0001)
  assert.equal(gateCrossing(1, before, after), null)
  assert.equal(gateCrossing(0, after, before), null)
  assert.equal(gateCrossing(0, { ...before, x: 900 }, { ...after, x: 900 }), null)
  assert.equal(gateCrossing(0, { ...before, y: -20 }, { ...after, y: -20 }), null)
  assert.equal(gateCrossing(0, { ...before, z: FINISH_Z - 0.2 }, { ...after, z: FINISH_Z + 0.1 }), null)
})

test('a rival can trigger a short instinct and Q spends resistance to end it', () => {
  const s = race(['elephant', 'turtle'])
  tick(s, 5)
  control(s, { ability: true }); tick(s)
  assert.equal(s.players()[1].instinct, 'Hide in shell')
  control(s, { resist: true }, '1'); tick(s)
  assert.equal(s.players()[1].instinct, '')
  assert.ok(s.players()[1].resistance < 0.9)
  tick(s, 140)
  assert.equal(s.players()[1].resistance, 1)
})

test('airborne special uses the configured cooldown and a held key cannot retrigger', () => {
  const s = race(['penguin'])
  tick(s, 5)
  control(s, { jump: true }); tick(s, 4)
  control(s, { ability: true }); tick(s)
  const sliding = s.players()[0]
  assert.equal(sliding.grounded, false)
  assert.equal(sliding.cooldown, 8)
  assert.ok(sliding.active)
  tick(s, 242)
  assert.equal(s.players()[0].stats.abilities, 1)
  control(s, {}); control(s, { ability: true }); tick(s)
  assert.equal(s.players()[0].stats.abilities, 2)
})

test('banana rain drops affect the racing field at the synchronized location', () => {
  const s = race()
  tick(s, 73, 'bananaRain')
  assert.equal(s.rainCenterZ, 0)
  for (let frame = 0; frame < 110; frame++) {
    const p = s.players()[0]
    const lane = centerAt(8) - 6
    control(s, { z: Math.min(1, Math.max(0, (8 - p.z) / 1.8)), x: Math.min(1, Math.max(-1, (p.x - lane) / 1.8)) })
    tick(s, 1, 'bananaRain')
  }
  assert.ok(s.players()[0].stats.collisions > 0)
})

test('four animals in a single world finish, rematch, and retain independent results', () => {
  const s = race(['elephant', 'penguin', 'gorilla', 'turtle'])
  for (let match = 0; match < 2; match++) {
    s.reset()
    for (let i = 0; i < 7200; i++) {
      const players = s.players().filter(p => p.finishTime === null)
      if (players.length === 0) break
      for (const p of players) followCourse(s, p, (Number(p.id) - 1.5) * 0.6)
      tick(s, 1, i >= 800 && i < 1040 ? (match === 0 ? 'lowGravity' : 'bananaRain') : null)
    }
    const racers = s.players()
    assert.ok(racers.every(p => p.checkpoint === CHECKPOINTS.length && p.finishTime !== null),
      JSON.stringify(racers))
    assert.equal(new Set(racers.map(p => p.finishTime)).size, 4)
    assert.ok(racers.every(p => Number.isFinite(p.x + p.y + p.z)))
  }
})

test('falling after a gate preserves its progress and returns the racer to that gate', () => {
  const s = race()
  for (let i = 0; i < 1200 && s.players()[0].checkpoint === 0; i++) {
    followCourse(s, s.players()[0]); tick(s)
  }
  assert.equal(s.players()[0].checkpoint, 1)
  control(s, { x: 1, sprint: true })
  for (let i = 0; i < 230 && s.players()[0].stats.falls === 0; i++) tick(s)
  const p = s.players()[0]
  assert.equal(p.stats.falls, 1)
  assert.equal(p.z, CHECKPOINTS[0] + 2)
  assert.equal(p.checkpoint, 1)
  assert.ok(p.grounded)
})

test('boosting into a moving barrier ends the rocket and steering recovers', () => {
  const s = race()
  let activated = false
  let hit = false
  for (let i = 0; i < 500; i++) {
    const p = s.players()[0]
    const barrierX = centerAt(92) + 5 * Math.sin((i / 30 + 0.25) * 0.7)
    const fire = p.z > 78 && !activated
    control(s, { z: 1, x: Math.max(-1, Math.min(1, (p.x - barrierX) / 3)), sprint: true, ability: fire })
    tick(s)
    if (fire) activated = true
    const next = s.players()[0]
    if (activated && next.stats.collisions > 0) {
      assert.equal(next.active, false)
      hit = true
      break
    }
  }
  assert.ok(hit)
  control(s, { x: -1 })
  tick(s, 36)
  assert.ok(s.players()[0].vx > 1)
})
