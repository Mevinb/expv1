import { CHECKPOINTS, centerAt, elevationAt, halfWidthAt } from '../../shared/src/track.js'

type Point = { x: number; y: number; z: number }

/** Return the fraction of this tick at which the front of the racer crossed the next gate. */
export function gateCrossing(completed: number, from: Point, to: Point): number | null {
  const gate = CHECKPOINTS[completed]
  if (gate === undefined || from.z > gate || to.z < gate || to.z <= from.z) return null
  const fraction = (gate - from.z) / (to.z - from.z)
  const x = from.x + (to.x - from.x) * fraction
  const y = from.y + (to.y - from.y) * fraction - elevationAt(gate)
  // At the bridge entrance the recovery deck is wider than the rope deck.
  const halfWidth = Math.max(halfWidthAt(gate - 0.1), halfWidthAt(gate)) + 0.65
  return Math.abs(x - centerAt(gate)) <= halfWidth && y >= -1 && y <= 9 ? fraction : null
}
