import { randomInt } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { isAnimal } from '@beast/shared/animals'
import { idleInput, type ClientEvents, type Input, type Reply, type ServerEvents } from '@beast/shared/protocol'
import { GameRoom, TICK_RATE } from './GameRoom.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function nickname(value: unknown) {
  if (typeof value !== 'string') throw new Error('Enter a racer name.')
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!name || [...name].length > 18) throw new Error('Use a racer name between 1 and 18 characters.')
  return name
}

function validInput(input: Input) {
  return input && [input.x, input.z, input.yaw].every(Number.isFinite)
    && Math.abs(input.x) <= 1 && Math.abs(input.z) <= 1
    && [input.jump, input.ability, input.interact, input.resist, input.sprint].every(v => typeof v === 'boolean')
}

export function attachGame(http: HttpServer, automatic = true) {
  const io = new Server<ClientEvents, ServerEvents>(http, { maxHttpBufferSize: 8192, serveClient: false })
  const rooms = new Map<string, GameRoom>()
  const publish = (room: GameRoom) => io.to(room.code).emit('snapshot', room.snapshot())

  io.on('connection', socket => {
    let current: GameRoom | undefined
    let inputExpiry: NodeJS.Timeout | undefined
    function room() {
      if (!current) throw new Error('Join a room first.')
      return current
    }
    function leave() {
      if (!current) return
      clearTimeout(inputExpiry)
      inputExpiry = undefined
      const old = current
      current = undefined
      socket.leave(old.code)
      old.remove(socket.id)
      if (old.members.size) publish(old)
      else { old.sim.dispose(); rooms.delete(old.code) }
    }
    function command(reply: Reply, fn: () => void) {
      if (typeof reply !== 'function') return
      try { fn(); reply({ ok: true }); if (current) publish(current) }
      catch (err) { reply({ ok: false, error: err instanceof Error ? err.message : 'Room action failed.' }) }
    }
    socket.on('create', (data, cb) => command(cb, () => {
      const name = nickname(data?.name)
      if (current) throw new Error('Leave your current room first.')
      let code: string
      do { code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('') } while (rooms.has(code))
      const made = new GameRoom(code, data.practice === true)
      made.add(socket.id, name)
      current = made
      rooms.set(code, made)
      socket.join(code)
      if (made.practice) made.begin(socket.id)
    }))
    socket.on('join', (data, cb) => command(cb, () => {
      const name = nickname(data?.name)
      if (current) throw new Error('Leave your current room first.')
      const found = rooms.get(String(data?.code ?? '').trim().toUpperCase())
      if (!found || found.practice) throw new Error('No open room matches that code.')
      found.add(socket.id, name)
      current = found
      socket.join(found.code)
    }))
    socket.on('select', (animal, cb) => command(cb, () => {
      const game = room()
      game.requirePhase('WAITING')
      if (!isAnimal(animal)) throw new Error('Unknown animal.')
      game.sim.select(socket.id, animal)
    }))
    socket.on('ready', (ready, cb) => command(cb, () => {
      const game = room()
      game.requirePhase('WAITING')
      if (typeof ready !== 'boolean') throw new Error('Invalid ready state.')
      game.members.get(socket.id)!.ready = ready
    }))
    socket.on('start', cb => command(cb, () => room().begin(socket.id)))
    socket.on('rematch', cb => command(cb, () => room().begin(socket.id, true)))
    socket.on('lobby', cb => command(cb, () => room().lobby(socket.id)))
    socket.on('leave', cb => command(cb, leave))
    socket.on('input', input => {
      if (!current || !validInput(input)) return
      current.sim.input(socket.id, input)
      if (inputExpiry) inputExpiry.refresh()
      else inputExpiry = setTimeout(() => {
        current?.sim.input(socket.id, idleInput())
        inputExpiry = undefined
      }, 600)
    })
    socket.on('disconnect', leave)
  })

  let tickNumber = 0
  function step() {
    tickNumber++
    for (const game of rooms.values()) {
      const before = game.phase
      game.step()
      if (before !== game.phase || (game.phase !== 'RESULTS' && tickNumber % 2 === 0)) publish(game)
    }
  }
  // Account for timer jitter while bounding catch-up after a long suspension.
  let next = performance.now()
  const timer = automatic ? setInterval(() => {
    const now = performance.now()
    next = Math.max(next, now - 100)
    while (next <= now) { step(); next += 1000 / TICK_RATE }
  }, 1000 / TICK_RATE) : undefined
  return { step, rooms, async close() {
    clearInterval(timer)
    await io.close()
    for (const game of rooms.values()) game.sim.dispose()
    rooms.clear()
  } }
}
