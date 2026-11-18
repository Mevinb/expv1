import { centerAt, elevationAt, zoneAt } from './track.js'

export interface WildlineGate {
  index: number
  zone: number
  x: number
  y: number
  z: number
  halfWidth: number
  height: number
}

export const WILDLINE_BURST_SECONDS = 2.2
export const WILDLINE_BURST_INTERVAL = 3

// An opening six metres wide teaches the first line. Later sets ask for a
// tighter entry, especially at the split lanes, the high deck and the mud cut.
const lines: [z: number, lane: number, halfWidth: number][] = [
  [23, -5, 3.3], [47, -3.2, 3.1], [71, -0.5, 2.9], [153, 6.5, 2.8],
  [239, -5.8, 2.9], [303, -7.8, 2.6], [375, -8, 2.4], [426, 3.4, 2.5],
  [483, -1.5, 2.4], [533, 2.3, 2.4], [588, -2, 2.4], [623, 1.4, 2.4],
  [699, -4.5, 2.8], [751, -10.2, 2.6], [824, -10.3, 2.4], [890, -4.3, 2.7],
  [954, 4.4, 2.7], [1033, -5.4, 2.6], [1085, -7.4, 2.7], [1172, 5.5, 2.6],
  [1226, -3.7, 2.7], [1312, 7.4, 2.5], [1382, -5.5, 2.6], [1445, 1.6, 2.5],
]

export const WILDLINE_GATES: readonly WildlineGate[] = lines.map(([z, lane, halfWidth], index) => ({
  index, zone: zoneAt(z), x: centerAt(z) + lane, y: elevationAt(z), z, halfWidth,
  height: z === 1085 ? 6.2 : 4.4,
}))
