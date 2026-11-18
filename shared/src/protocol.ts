export type Animal = 'elephant' | 'penguin' | 'gorilla' | 'turtle'
export type Phase = 'WAITING' | 'COUNTDOWN' | 'RACING' | 'RESULTS'
export type RaceEvent = 'lowGravity' | 'bananaRain'
export type Input = {
  x: number; z: number; yaw: number
  jump: boolean; sprint: boolean; ability: boolean; interact: boolean; resist: boolean
}
export const idleInput = (): Input => ({ x: 0, z: 0, yaw: 0, jump: false, sprint: false, ability: false, interact: false, resist: false })
export interface Racer {
  id: string
  animal: Animal
  x: number; y: number; z: number; yaw: number
  vx: number; vy: number; vz: number
  grounded: boolean
  cooldown: number
  active: boolean
  instinct: string
  resistance: number
  checkpoint: number
  finishTime: number | null
  wildline: { hits: number; chain: number; best: number; burst: number; lastGate: number; verdict: 'hit' | 'miss' | null }
  stats: { collisions: number; airborne: number; falls: number; biggestFall: number; abilities: number; throws: number; backward: number }
}
export interface Player extends Racer { name: string; ready: boolean; place: number; bot?: boolean }
export interface Snapshot {
  code: string; hostId: string; practice: boolean; cup?: boolean; phase: Phase
  elapsed: number; countdown: number; timeLimit: number
  event: { kind: RaceEvent; stage: 'warning' | 'active'; remaining: number; centerZ?: number } | null
  players: Player[]
}
export type Reply = (result: { ok: boolean; error?: string }) => void
export interface ClientEvents {
  create: (data: { name: string; practice?: boolean }, cb: Reply) => void
  join: (data: { name: string; code: string }, cb: Reply) => void
  select: (animal: Animal, cb: Reply) => void
  ready: (ready: boolean, cb: Reply) => void
  start: (cb: Reply) => void
  rematch: (cb: Reply) => void
  lobby: (cb: Reply) => void
  leave: (cb: Reply) => void
  input: (input: Input) => void
}
export interface ServerEvents { snapshot: (snapshot: Snapshot) => void }
