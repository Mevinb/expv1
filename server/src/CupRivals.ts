import { idleInput, type Animal, type Input, type Racer } from '../../shared/src/protocol.js'
import { centerAt, HAZARDS, hazardPose, zoneAt } from '../../shared/src/track.js'
import { WILDLINE_GATES } from '../../shared/src/wildlines.js'

interface Rival {
  name: string
  side: number
  precision: number
  reaction: number
}

export const CUP_RIVALS: Record<Animal, Rival> = {
  penguin: { name: 'Skid', side: -1, precision: .86, reaction: .43 },
  gorilla: { name: 'Bruno', side: 1, precision: .55, reaction: .59 },
  turtle: { name: 'Marble', side: 1, precision: .72, reaction: .31 },
  elephant: { name: 'Boomer', side: -1, precision: .58, reaction: .68 },
}

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value))

function racingLine(racer: Racer, elapsed: number, rival: Rival) {
  const look = racer.z + 6
  const zone = zoneAt(look)
  const signedLane = rival.side
  const lateral = [
    signedLane * 7.8,
    signedLane * 8.4,
    signedLane * 1.9,
    -9.9 + signedLane * .85,
    signedLane * 8.3,
    signedLane * 8.8,
  ][zone]
  let target = lateral
  const gate = WILDLINE_GATES[racer.wildline.lastGate + 1]
  const distance = gate ? gate.z - look : Infinity
  if (gate && distance > -4 && distance < 36) {
    const gateLane = gate.x - centerAt(gate.z)
    // Commit to one side of the banana and final forks. A rival can deliberately
    // sacrifice a chain to take the clearer lane through the island.
    const acrossSplit = ((look > 260 && look < 398) || (look > 1274 && look < 1342)) && gateLane * lateral < 0
    if (!acrossSplit) {
      const weight = clamp((36 - distance) / 13, 0, 1) * rival.precision
      target += (gateLane - target) * weight
    }
  }
  // Read the moving obstacles at the expected time of arrival, like aiming
  // outside a log's sweep. Interaction and jump decisions remain separate.
  for (const hazard of HAZARDS) {
    if (hazard.kind === 'banana' || hazard.kind === 'peel') continue
    const approach = hazard.z - look
    if (approach < -3 || approach > 21) continue
    const pose = hazardPose(hazard, elapsed + Math.max(0, approach) / 12)
    if (Math.abs(pose.z - look) > 23) continue
    const obstacleLane = pose.x - centerAt(pose.z)
    const minClearance = hazard.width / 2 + 1.3
    if (Math.abs(target - obstacleLane) < minClearance) {
      const direction = Math.sign(target - obstacleLane) || signedLane
      target = clamp(obstacleLane + direction * minClearance, -10.5, 10.5)
    }
  }
  return centerAt(look) + target
}

/** Cup rivals submit the same axes and buttons as a keyboard player. */
export function driveRival(racer: Racer, field: Racer[], human: Racer, tick: number): Input {
  const input = idleInput()
  const profile = CUP_RIVALS[racer.animal]
  const elapsed = tick / 30
  if (elapsed < profile.reaction || racer.finishTime !== null) return input
  const target = racingLine(racer, elapsed, profile)
  const delta = target - racer.x
  const lead = racer.z - human.z
  const beat = Math.floor(elapsed * 1.5 + profile.reaction * 12) % 5
  const chasing = lead < -10
  input.z = lead > 28 ? .82 : 1
  input.x = clamp(-delta / 3.7, -1, 1)
  input.sprint = chasing || lead < 18 && beat !== 0
  input.resist = !!racer.instinct && racer.resistance > .3

  const nearby = field.some(other => other.id !== racer.id && other.finishTime === null &&
    Math.hypot(other.x - racer.x, other.y - racer.y, other.z - racer.z) < 3.45)
  if (racer.animal === 'gorilla') {
    input.interact = nearby && racer.cooldown <= 0 && tick % 5 === 0
    input.ability = racer.active && tick % 14 === 0
  } else {
    const aligned = Math.abs(delta) < 1.9 && Math.abs(Math.sin(racer.yaw)) < .4
    const clearAhead = zoneAt(racer.z) !== 2 && !((racer.z >= 236 && racer.z <= 285) || (racer.z >= 1260 && racer.z <= 1290))
    input.ability = elapsed > 2 && racer.cooldown <= 0 && aligned && clearAhead && lead < 13 && tick % 9 === 0
  }
  // Jump at a remaining obstruction, or wriggle out after a rival's grab.
  const blocked = racer.vz < 1.3 && elapsed > 4 && racer.grounded
  input.jump = (blocked || !racer.grounded && racer.vz < .8) && tick % 18 === 0
  return input
}
