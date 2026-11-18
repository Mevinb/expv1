import type { Racer } from '../../shared/src/protocol.js'
import { WILDLINE_BURST_INTERVAL, WILDLINE_BURST_SECONDS, WILDLINE_GATES } from '../../shared/src/wildlines.js'

type Point = Pick<Racer, 'x' | 'y' | 'z'>

export function freshWildline(): Racer['wildline'] {
  return { hits: 0, chain: 0, best: 0, burst: 0, lastGate: -1, verdict: null }
}

// Process only forward plane crossings. The high-water mark survives respawns
// and reversing, so retracing the course cannot farm the same gate twice.
export function crossWildline(line: Racer['wildline'], from: Point, to: Point) {
  if (to.z <= from.z) return
  const gate = WILDLINE_GATES[line.lastGate + 1]
  if (!gate || from.z > gate.z || to.z < gate.z) return
  const fraction = (gate.z - from.z) / (to.z - from.z)
  const x = from.x + (to.x - from.x) * fraction
  const y = from.y + (to.y - from.y) * fraction
  line.lastGate = gate.index
  if (Math.abs(x - gate.x) <= gate.halfWidth && y >= gate.y - .05 && y <= gate.y + gate.height) {
    line.verdict = 'hit'
    line.hits++
    line.chain++
    line.best = Math.max(line.best, line.chain)
    if (line.chain % WILDLINE_BURST_INTERVAL === 0) line.burst = WILDLINE_BURST_SECONDS
  } else {
    line.verdict = 'miss'
    line.chain = 0
  }
}
