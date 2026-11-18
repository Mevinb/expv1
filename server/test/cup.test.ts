import { afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { idleInput } from '../../shared/src/protocol.js'
import { CHECKPOINTS, centerAt } from '../../shared/src/track.js'
import { WILDLINE_BURST_SECONDS, WILDLINE_GATES } from '../../shared/src/wildlines.js'
import { GameRoom } from '../src/GameRoom.js'
import { initPhysics } from '../src/Simulation.js'
import { crossWildline, freshWildline } from '../src/Wildline.js'

const rooms: GameRoom[] = []
before(initPhysics)
afterEach(() => { while (rooms.length) rooms.pop()!.sim.dispose() })

function cup(animal: 'elephant' | 'penguin') {
  const room = new GameRoom('LOCAL', true, true)
  rooms.push(room)
  room.add('local', 'Rookie')
  room.sim.select('local', animal)
  room.begin('local')
  room.eventAt = 32
  room.eventKind = 'bananaRain'
  return room
}

test('Wildline counts each gate once in order, scores the interpolated opening and breaks a missed chain', () => {
  const line = freshWildline()
  function cross(index: number, dx = 0, height = 1) {
    const gate = WILDLINE_GATES[index]
    const p = { x: gate.x + dx, y: gate.y + height, z: gate.z - .2 }
    crossWildline(line, p, { ...p, z: gate.z + .2 })
  }
  cross(1)
  assert.equal(line.hits, 0)
  cross(0)
  cross(0)
  assert.equal(line.hits, 1)
  cross(1)
  cross(2)
  assert.equal(line.chain, 3)
  assert.equal(line.best, 3)
  assert.equal(line.burst, WILDLINE_BURST_SECONDS)
  cross(3, WILDLINE_GATES[3].halfWidth + .05)
  assert.equal(line.verdict, 'miss')
  assert.equal(line.chain, 0)
  cross(4, 0, WILDLINE_GATES[4].height + .05)
  assert.equal(line.hits, 3)
  const gate = WILDLINE_GATES[5]
  const before = { x: gate.x - 4, y: gate.y + 1, z: gate.z - .5 }
  const after = { x: gate.x + 4, y: gate.y + 1, z: gate.z + .5 }
  crossWildline(line, after, before)
  assert.equal(line.lastGate, 4)
  crossWildline(line, before, after)
  assert.equal(line.chain, 1)
  assert.equal(line.best, 3)
  assert.equal(line.hits, 4)
  assert.equal(new Set(WILDLINE_GATES.map(gate => gate.zone)).size, 6)
})

test('three physical gate crossings produce a speed burst; respawn cannot replay spent gates', () => {
  const room = new GameRoom('TRAIN', true)
  rooms.push(room)
  room.add('p', 'Learner')
  room.begin('p')
  let burstStart = 0
  let peak = 0
  for (let frame = 0; frame < 1200; frame++) {
    const p = room.sim.players()[0]
    const gate = WILDLINE_GATES[Math.min(2, p.wildline.lastGate + 1)]
    const targetX = p.wildline.lastGate >= 2 ? p.x : gate.x
    room.sim.input('p', { ...idleInput(), z: 1, x: Math.max(-1, Math.min(1, (p.x - targetX) / 2)), sprint: true })
    room.step()
    const next = room.sim.players()[0]
    if (next.wildline.burst > 0) {
      if (!burstStart) burstStart = room.ticks
      peak = Math.max(peak, next.vz)
    }
    if (burstStart && room.ticks - burstStart > 22) break
  }
  assert.ok(burstStart > 0 && peak > 16)
  assert.equal(room.sim.players()[0].wildline.hits, 3)
  room.sim.input('p', { ...idleInput(), x: 1, sprint: true })
  for (let i = 0; i < 300 && room.sim.players()[0].stats.falls === 0; i++) room.step()
  const recovered = room.sim.players()[0]
  assert.equal(recovered.stats.falls, 1)
  assert.equal(recovered.wildline.chain, 0)
  assert.equal(recovered.wildline.burst, 0)
  assert.equal(recovered.wildline.lastGate, 2)
  assert.equal(recovered.wildline.best, 3)
})

test('all three named cup rivals physically finish six checkpoints while a player observes', () => {
  const room = cup('elephant')
  const grid = room.snapshot()
  assert.equal(grid.cup, true)
  assert.equal(grid.players.filter(p => p.bot).length, 3)
  assert.equal(new Set(grid.players.map(p => p.animal)).size, 4)
  for (let tick = 0; tick < 7350 && room.phase !== 'RESULTS'; tick++) room.step()
  const results = room.snapshot()
  const rivals = results.players.filter(p => p.bot)
  assert.equal(results.phase, 'RESULTS')
  assert.equal(new Set(rivals.map(p => p.name)).size, 3)
  assert.ok(rivals.every(p => p.checkpoint === CHECKPOINTS.length && p.finishTime !== null && p.wildline.hits >= 3))
  assert.ok(rivals.some(p => p.stats.abilities > 0))
  assert.equal(results.players.find(p => !p.bot)?.finishTime, null)
  room.lobby('local')
  assert.equal(room.snapshot().players.length, 1)
  room.sim.select('local', 'gorilla')
  room.begin('local')
  assert.equal(new Set(room.snapshot().players.map(p => p.animal)).size, 4)
  assert.ok(room.snapshot().players.every(p => p.wildline.hits === 0 && p.finishTime === null))
})

test('the player gets a cup result promptly with authentic times, and rematch clears the field', () => {
  const room = cup('penguin')
  for (let tick = 0; tick < 7350 && room.phase !== 'RESULTS'; tick++) {
    const racer = room.sim.players().find(p => p.id === 'local')!
    const look = racer.z + 5
    let lane = 8.7
    if (look >= 205 && look < 438) lane = -8.5
    if (look >= 438 && look < 670) lane = 0
    if (look >= 670 && look < 921) lane = -10.3
    const dx = (racer.x - centerAt(look) - lane) / 3
    room.sim.input('local', { ...idleInput(), z: 1, x: Math.max(-1, Math.min(1, dx)), sprint: true })
    room.step()
  }
  const result = room.snapshot()
  const human = result.players.find(p => !p.bot)!
  assert.equal(result.phase, 'RESULTS')
  assert.ok(human.finishTime !== null && result.elapsed - human.finishTime <= 2.05)
  assert.ok(result.players.some(p => p.bot && p.stats.abilities > 0))
  assert.deepEqual(result.players.map(p => p.place), [1, 2, 3, 4])
  room.begin('local', true)
  const restart = room.snapshot()
  assert.equal(restart.phase, 'COUNTDOWN')
  assert.equal(restart.players.length, 4)
  assert.ok(restart.players.every(p => p.checkpoint === 0 && p.wildline.lastGate === -1 && p.finishTime === null))
})
