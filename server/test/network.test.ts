import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { io, type Socket } from 'socket.io-client'
import { centerAt, CHECKPOINTS } from '@beast/shared/track'
import { idleInput, type ClientEvents, type Reply, type ServerEvents, type Snapshot } from '@beast/shared/protocol'
import { attachGame } from '../src/network.js'
import { initPhysics } from '../src/Simulation.js'

type Client = Socket<ServerEvents, ClientEvents>
const clients: Client[] = []
const last = new Map<Client, Snapshot>()
const http = createServer()
let service: ReturnType<typeof attachGame>
before(async () => {
  await initPhysics()
  service = attachGame(http, false)
  http.listen(0, '127.0.0.1')
  await once(http, 'listening')
})
after(async () => { clients.forEach(s => s.disconnect()); await service.close() })
async function connect() {
  const client: Client = io('http://127.0.0.1:' + (http.address() as AddressInfo).port,
    { transports: ['websocket'], forceNew: true, reconnection: false, autoConnect: false })
  client.on('snapshot', snapshot => last.set(client, snapshot))
  const connected = new Promise<void>((resolve, reject) => {
    client.once('connect', resolve); client.once('connect_error', reject)
  })
  client.connect()
  await connected
  clients.push(client)
  return client
}
async function act(send: (cb: Reply) => void, ok = true) {
  const response = await new Promise<Parameters<Reply>[0]>(send)
  assert.equal(response.ok, ok, response.error)
}
async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 120; i++) {
    if (condition()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.ok(condition(), 'server update did not reach the client')
}
test('2, 4 and 8 connections see their room; authority, capacity, host transfer and rematches', async () => {
  const peers = await Promise.all(Array.from({ length: 9 }, connect))
  const [host, guest] = peers
  await act(cb => host.emit('create', { name: 'Starter' }, cb))
  await waitFor(() => last.has(host))
  const code = last.get(host)!.code
  const game = service.rooms.get(code)!
  await act(cb => host.emit('start', cb), false)
  await act(cb => guest.emit('join', { name: '', code }, cb), false)
  for (let i = 1; i < 8; i++) {
    await act(cb => peers[i].emit('join', { name: 'Racer ' + i, code: code.toLowerCase() }, cb))
    if ([1,3,7].includes(i)) {
      await waitFor(() => peers.slice(0, i + 1).every(s => last.get(s)?.players.length === i + 1))
    }
  }
  await act(cb => peers[8].emit('join', { name: 'Ninth', code }, cb), false)
  await act(cb => guest.emit('start', cb), false)
  await act(cb => host.emit('start', cb), false)
  await act(cb => guest.emit('select', 'turtle', cb))
  await act(cb => guest.emit('select', 'constructor' as never, cb), false)
  await act(cb => guest.emit('create', { name: 'Racer' }, cb), false)
  for (const peer of peers.slice(1,8)) await act(cb => peer.emit('ready', true, cb))
  await act(cb => host.emit('start', cb))
  await waitFor(() => last.get(guest)?.phase === 'COUNTDOWN')
  assert.equal(last.get(guest)?.countdown, 3)
  await act(cb => peers[8].emit('join', { name: 'Late', code }, cb), false)
  for (let i = 0; i < 90; i++) game.step()
  assert.equal(game.phase, 'RACING')
  const initial = game.snapshot()
  // Unknown fields and invalid numeric inputs must never set a position, clock or result.
  guest.emit('input', { ...idleInput(), x: 300, finishTime: 0, checkpoint: 999 } as never)
  guest.emit('input', { ...idleInput(), z: 1, id: host.id, finishTime: 0 } as never)
  await act(cb => guest.emit('select', 'penguin', cb), false) // ordered socket barrier
  for (let i = 0; i < 20; i++) service.step()
  await waitFor(() => (last.get(guest)?.elapsed ?? 0) > 0.5)
  assert.equal(last.get(guest)?.players.find(p => p.id === guest.id)?.finishTime, null)
  const moved = last.get(guest)!.players.find(p => p.id === guest.id)!
  assert.ok(moved.z > initial.players.find(p => p.id === guest.id)!.z + 0.3)
  assert.deepEqual(last.get(guest), last.get(host))
  // A silent tab must stop moving before the transport times out.
  await new Promise(resolve => setTimeout(resolve, 650))
  for (let i = 0; i < 60; i++) game.step()
  assert.ok(Math.abs(game.snapshot().players.find(p => p.id === guest.id)!.vz) < .1)
  host.disconnect()
  await waitFor(() => last.get(guest)?.hostId === guest.id)
  for (const peer of peers.slice(2, 8)) peer.disconnect()
  await waitFor(() => last.get(guest)?.phase === 'RESULTS')
  await act(cb => guest.emit('rematch', cb), false)
  await act(cb => guest.emit('lobby', cb))
  await act(cb => peers[8].emit('join', { name: 'Second', code }, cb))
  await act(cb => peers[8].emit('ready', true, cb))
  await act(cb => guest.emit('start', cb))
  for (let i = 0; i < 90 + 30 * 240; i++) game.step()
  service.step()
  assert.equal(game.phase, 'RESULTS')
  await act(cb => peers[8].emit('rematch', cb), false)
  await act(cb => guest.emit('rematch', cb))
  await waitFor(() => last.get(guest)?.phase === 'COUNTDOWN')
  assert.equal(last.get(guest)?.elapsed, 0)
  assert.ok(last.get(guest)!.players.every(p => p.cooldown === 0 && p.checkpoint === 0))
  await act(cb => peers[8].emit('leave', cb))
  await waitFor(() => last.get(guest)?.phase === 'WAITING')
  await act(cb => guest.emit('leave', cb))
  assert.equal(service.rooms.size, 0)
})

test('practice stays private, runs a single racer and cleans up on exit', async () => {
  const a = await connect(), b = await connect()
  await act(cb => a.emit('create', { name: 'Solo', practice: true }, cb))
  await waitFor(() => last.get(a)?.phase === 'COUNTDOWN')
  const { code } = last.get(a)!
  await act(cb => b.emit('join', { code, name: 'Observer' }, cb), false)
  await act(cb => a.emit('lobby', cb))
  await act(cb => a.emit('select', 'turtle', cb))
  await act(cb => a.emit('start', cb))
  await waitFor(() => last.get(a)?.phase === 'COUNTDOWN' && last.get(a)?.players[0].animal === 'turtle')
  await act(cb => a.emit('leave', cb))
  assert.equal(service.rooms.size, 0)
})

test('four network racers finish every checkpoint, agree on results and rematch', async () => {
  const peers = await Promise.all(Array.from({ length: 4 }, connect))
  const [host] = peers
  await act(cb => host.emit('create', { name: 'Elephant' }, cb))
  await waitFor(() => last.has(host))
  const game = service.rooms.get(last.get(host)!.code)!
  for (const [i, peer] of peers.slice(1).entries()) {
    await act(cb => peer.emit('join', { name: ['Penguin','Gorilla','Turtle'][i], code: game.code }, cb))
    await act(cb => peer.emit('ready', true, cb))
  }
  await act(cb => host.emit('start', cb))
  const seen = new Set<string>()
  for (let batch = 0; batch < 1240 && game.phase !== 'RESULTS'; batch++) {
    // Clients steer using only previously broadcast positions. Fast-forward six
    // ordinary simulation ticks at a time to keep a two-minute race cheap in CI.
    const before = game.ticks
    for (const [i, peer] of peers.entries()) {
      const p = last.get(peer)?.players.find(player => player.id === peer.id)
      if (!p || p.finishTime !== null) continue
      const z = p.z + 5
      const lane = z < 205 ? 8.7 : z < 438 ? -8.5 : z < 670 ? 0 : z < 921 ? -10.3 : 8.7
      const offset = (i % 2 === 0 ? 1 : -1) * .75
      const x = Math.max(-1, Math.min(1, (p.x - centerAt(z) - lane - offset) / 3))
      peer.emit('input', { ...idleInput(), z: 1, x, sprint: true })
    }
    // An ordered event on each transport confirms its input arrived at the server.
    await Promise.all(peers.map(peer => act(cb => peer.emit('ready', true, cb), false)))
    for (let t = 0; t < 6; t++) service.step()
    const event = game.event()
    if (event) seen.add(event.stage)
    if (game.ticks > before) {
      await waitFor(() => (last.get(host)?.elapsed ?? -1) >= (game.ticks - 1) / 30)
    }
  }
  await waitFor(() => peers.every(peer => last.get(peer)?.phase === 'RESULTS'))
  const results = last.get(host)!
  assert.ok(results.players.every(p => p.checkpoint === CHECKPOINTS.length && p.finishTime !== null),
    JSON.stringify(results.players.map(p => [p.name, p.checkpoint, p.z, p.stats.falls])))
  assert.deepEqual([...seen].sort(), ['active','warning'])
  assert.deepEqual(results.players.map(p => p.place), [1,2,3,4])
  for (const peer of peers) assert.deepEqual(last.get(peer), results)
  const winner = peers.find(peer => peer.id === results.players[0].id)!
  const remaining = peers.filter(peer => peer !== winner)
  winner.disconnect()
  await waitFor(() => game.members.size === 3)
  assert.deepEqual(game.snapshot().players, results.players, 'the podium survives a finisher disconnect')
  const rematchHost = remaining.find(peer => peer.id === game.hostId)!
  await act(cb => rematchHost.emit('rematch', cb))
  await waitFor(() => remaining.every(peer => last.get(peer)?.phase === 'COUNTDOWN'))
  assert.equal(last.get(rematchHost)?.players.length, 3)
  for (const peer of remaining) await act(cb => peer.emit('leave', cb))
  assert.equal(service.rooms.size, 0)
})
