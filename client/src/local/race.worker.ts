import type { Phase } from '@beast/shared/protocol'
import { GameRoom, TICK_RATE } from '../../../server/src/GameRoom'
import { initPhysics } from '../../../server/src/Simulation'
import { ANIMALS } from '@beast/shared/animals'
import { LOCAL_ID, type LocalCommand, type LocalUpdate } from './messages'

let room: GameRoom | undefined
let paused = false
let next = 0
let ticks = 0
const send = (message: LocalUpdate) => self.postMessage(message)
const publish = () => { if (room) send({ type: 'snapshot', snapshot: room.snapshot() }) }

self.onmessage = async (event: MessageEvent<LocalCommand>) => {
  const message = event.data
  try {
    if (message.type === 'launch') {
      await initPhysics()
      room = new GameRoom(message.cup ? 'CUP' : 'SOLO', true, message.cup)
      room.add(LOCAL_ID, message.name)
      room.sim.select(LOCAL_ID, message.animal in ANIMALS ? message.animal : 'elephant')
      room.begin(LOCAL_ID)
      next = performance.now() + 1000 / TICK_RATE
    } else if (message.type === 'pause') {
      paused = message.paused
      next = performance.now() + 1000 / TICK_RATE
      return
    } else if (room) {
      switch (message.type) {
        case 'input': room.sim.input(LOCAL_ID, message.input); return
        case 'select': room.requirePhase('WAITING'); room.sim.select(LOCAL_ID, message.animal); break
        case 'start': room.begin(LOCAL_ID); break
        case 'rematch': room.begin(LOCAL_ID, true); break
        case 'lobby': room.lobby(LOCAL_ID); break
      }
    }
    publish()
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Could not load the local race.', fatal: message.type === 'launch' })
  }
}

// The worker and Socket.IO server run the same fixed step, rules and physics.
// No local Cup positions or results are submitted to multiplayer rooms.
setInterval(() => {
  if (!room || paused || room.phase === 'RESULTS') return
  const now = performance.now()
  next = Math.max(next, now - 100)
  let dirty = false
  while (next <= now) {
    const phase: Phase = room.phase
    room.step()
    if (++ticks % 2 === 0 || room.phase !== phase) dirty = true
    next += 1000 / TICK_RATE
  }
  if (dirty) publish()
}, 1000 / TICK_RATE)
