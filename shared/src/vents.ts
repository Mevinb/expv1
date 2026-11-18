import { centerAt, elevationAt } from './track.js'

export interface SteamVent {
  id: number
  x: number
  y: number
  z: number
  radius: number
  phase: number
}

export const VENT_CYCLE = 7.2
const COOL_SECONDS = 4.15
const WARNING_SECONDS = 1.45

const sites = [
  [410, 6, 0.45],
  [803, -4.8, 3.4],
  [997, 4.1, 1.7],
  [1126, -5.3, 5.1],
  [1394, 5.5, 2.6],
] as const

export const STEAM_VENTS: readonly SteamVent[] = sites.map(([z, lane, phase], id) => ({
  id, z, phase, x: centerAt(z) + lane, y: elevationAt(z), radius: 2.15,
}))

export function ventState(vent: SteamVent, elapsed: number): { stage: 'cool' | 'warning' | 'erupting'; progress: number } {
  const t = (Math.max(0, elapsed) + vent.phase) % VENT_CYCLE
  if (t < COOL_SECONDS) return { stage: 'cool', progress: t / COOL_SECONDS }
  if (t < COOL_SECONDS + WARNING_SECONDS) {
    return { stage: 'warning', progress: (t - COOL_SECONDS) / WARNING_SECONDS }
  }
  return { stage: 'erupting', progress: (t - COOL_SECONDS - WARNING_SECONDS) / (VENT_CYCLE - COOL_SECONDS - WARNING_SECONDS) }
}
