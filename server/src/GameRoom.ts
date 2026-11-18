import type { Animal, Phase, Player, RaceEvent, Snapshot } from '@beast/shared/protocol'
import { Simulation } from './Simulation.js'

export const TICK_RATE = 30
const RACE_LIMIT = 240
const ANIMAL_GRID: Animal[] = ['elephant', 'penguin', 'gorilla', 'turtle']

export class GameRoom {
  readonly sim = new Simulation()
  readonly members = new Map<string, { name: string; ready: boolean; slot: number }>()
  hostId = ''
  phase: Phase = 'WAITING'
  ticks = 0
  countdownTicks = 0
  eventKind: RaceEvent = 'lowGravity'
  eventAt = 0
  private results: Player[] = []
  private departedFinishers: Player[] = []

  constructor(readonly code: string, readonly practice: boolean) {}

  add(id: string, name: string) {
    if (this.phase !== 'WAITING') throw new Error('That race is already underway.')
    if (this.members.size >= (this.practice ? 1 : 8)) throw new Error('This room is full.')
    const slots = new Set([...this.members.values()].map(member => member.slot))
    let slot = 0
    while (slots.has(slot)) slot++
    this.sim.add(id, ANIMAL_GRID[slot % ANIMAL_GRID.length], slot)
    this.members.set(id, { name, ready: this.members.size === 0, slot })
    if (!this.hostId) this.hostId = id
  }

  remove(id: string) {
    if (this.phase === 'RACING') {
      const finished = this.livePlayers().find(player => player.id === id && player.finishTime !== null)
      if (finished) this.departedFinishers.push(finished)
    }
    this.sim.remove(id)
    this.members.delete(id)
    if (id === this.hostId) {
      this.hostId = this.members.keys().next().value ?? ''
      const host = this.members.get(this.hostId)
      if (host) host.ready = true
    }
    if (this.members.size < 2 && !this.practice && this.phase !== 'WAITING') {
      if (this.phase === 'COUNTDOWN') {
        this.phase = 'WAITING'; this.countdownTicks = 0
      } else if (this.phase === 'RACING') this.finish()
    }
  }

  requireHost(id: string) {
    if (id !== this.hostId) throw new Error('Only the host can do that.')
  }

  requirePhase(phase: Phase) {
    if (this.phase !== phase) throw new Error('That action is unavailable at this stage.')
  }

  begin(id: string, rematch = false) {
    this.requireHost(id)
    this.requirePhase(rematch ? 'RESULTS' : 'WAITING')
    if (!this.practice && this.members.size < 2) throw new Error('Invite at least one more racer.')
    if (!rematch && [...this.members].some(([peer, member]) => peer !== id && !member.ready)) {
      throw new Error('Wait for everyone to ready up.')
    }
    this.sim.reset()
    this.results = []; this.departedFinishers = []
    this.ticks = 0
    this.countdownTicks = 3 * TICK_RATE
    this.eventKind = Math.random() < 0.5 ? 'lowGravity' : 'bananaRain'
    this.eventAt = 24 + Math.floor(Math.random() * 16)
    this.phase = 'COUNTDOWN'
  }

  lobby(id: string) {
    this.requireHost(id)
    if (!this.practice || this.phase === 'WAITING') this.requirePhase('RESULTS')
    this.sim.reset()
    this.ticks = this.countdownTicks = 0
    this.phase = 'WAITING'
    for (const [peer, member] of this.members) member.ready = peer === id
  }

  event(): Snapshot['event'] {
    const age = this.ticks / TICK_RATE - this.eventAt
    if (this.phase !== 'RACING' || age < -3 || age >= 8) return null
    return { kind: this.eventKind, stage: age < 0 ? 'warning' : 'active',
      remaining: age < 0 ? -age : 8 - age, centerZ: this.sim.rainCenterZ }
  }

  step() {
    if (this.phase === 'RESULTS') return
    if (this.phase === 'RACING') this.ticks++
    const event = this.event()
    this.sim.step(this.phase, event?.stage === 'active' ? event.kind : null)
    if (this.phase === 'COUNTDOWN' && --this.countdownTicks <= 0) this.phase = 'RACING'
    else if (this.phase === 'RACING') {
      if (this.ticks >= RACE_LIMIT * TICK_RATE || this.sim.players().every(p => p.finishTime !== null)) {
        this.finish()
      }
    }
  }

  private livePlayers(): Player[] {
    return this.sim.players().map(racer => {
      const { name, ready } = this.members.get(racer.id)!
      return { ...racer, name, ready, place: 0 }
    })
  }

  private ranked(players: Player[]) {
    players.sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime
      if (a.finishTime !== null) return -1
      if (b.finishTime !== null) return 1
      return b.checkpoint - a.checkpoint || b.z - a.z
    })
    players.forEach((player, index) => { player.place = index + 1 })
    return players
  }

  private finish() {
    this.phase = 'RESULTS'
    this.results = this.ranked([...this.departedFinishers, ...this.livePlayers()])
  }

  snapshot(): Snapshot {
    const players = this.phase === 'RESULTS' ? this.results : this.ranked(this.livePlayers())
    return { code: this.code, practice: this.practice, hostId: this.hostId, phase: this.phase,
      elapsed: this.ticks / TICK_RATE, countdown: Math.ceil(this.countdownTicks / TICK_RATE),
      timeLimit: RACE_LIMIT, event: this.event(), players }
  }
}
