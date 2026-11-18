import RAPIER from '@dimforge/rapier3d-compat'
import { ABILITIES } from '../../shared/src/abilities.js'
import { ANIMALS } from '../../shared/src/animals.js'
import { idleInput, type Animal, type Input, type Phase, type RaceEvent, type Racer } from '../../shared/src/protocol.js'
import { START_Z, CHECKPOINTS, ROAD, HAZARDS, bridgeSag, centerAt, elevationAt, hazardPose, rainDrop, zoneAt, type Hazard, type RoadPatch } from '../../shared/src/track.js'

import { crossWildline, freshWildline } from './Wildline.js'
import { gateCrossing } from './checkpoints.js'

const DT = 1 / 30
const FOOT = 0.84
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const yRotation = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
const xRotation = (angle: number) => ({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) })
let initialized: Promise<void> | undefined
export function initPhysics() { return initialized ??= RAPIER.init() }

interface Driver {
  state: Racer
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  grid: number
  peakY: number
  control: Input
  pressed: { jump: boolean; ability: boolean; interact: boolean }
  power: number
  stun: number
  instinctTime: number
  instinctLock: number
  holding: string | null
  heldBy: string | null
  seenPickups: Set<string>
}
type Prop = { hazard: Hazard; body: RAPIER.RigidBody }
const newStats = () => ({ collisions: 0, airborne: 0, falls: 0, biggestFall: 0, abilities: 0, throws: 0, backward: 0 })

export class Simulation {
  private world = new RAPIER.World({ x: 0, y: -24, z: 0 })
  private queue = new RAPIER.EventQueue(true)
  private drivers = new Map<string, Driver>()
  private contacts = new Map<number, Driver>()
  private obstacles = new Map<number, Hazard>()
  private props: Prop[] = []
  private decks: { patch: RoadPatch; body: RAPIER.RigidBody }[] = []
  private ticks = 0
  private previousEvent: RaceEvent | null = null
  private rainAge = 0
  rainCenterZ = 0

  constructor() {
    this.world.timestep = DT
    for (const patch of ROAD) {
      const q = xRotation(patch.tilt)
      const shape = RAPIER.ColliderDesc.cuboid(patch.width / 2, 0.42, patch.length / 2 + 0.02)
        .setFriction(patch.surface === 'mud' ? 0.64 : 0.35)
      if (patch.surface === 'bridge') {
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(patch.x, patch.y - 0.42, patch.z).setRotation(q))
        this.world.createCollider(shape, body)
        this.decks.push({ patch, body })
      } else {
        this.world.createCollider(shape.setTranslation(patch.x, patch.y - 0.42 * Math.cos(patch.tilt),
          patch.z - 0.42 * Math.sin(patch.tilt)).setRotation(q))
      }
    }
    for (const hazard of HAZARDS) {
      const p = hazardPose(hazard, 0)
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(p.x, p.y, p.z).setRotation(yRotation(p.yaw)))
      const shape = hazard.kind === 'boulder' ? RAPIER.ColliderDesc.ball(hazard.width / 2)
        : RAPIER.ColliderDesc.cuboid(hazard.width / 2, hazard.height / 2, hazard.depth / 2)
      const collider = this.world.createCollider(shape.setSensor(hazard.kind === 'peel' || hazard.kind === 'banana')
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body)
      this.props.push({ hazard, body })
      this.obstacles.set(collider.handle, hazard)
    }
  }

  add(id: string, animal: Animal, index: number) {
    if (this.drivers.has(id)) return
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockRotations().setCcdEnabled(true)
      .setLinearDamping(0.05).setCanSleep(false))
    const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.31, FOOT - 0.31)
      .setMass(ANIMALS[animal].mass).setFriction(0.12).setRestitution(0.04)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body)
    const state: Racer = { id, animal, x: 0, y: 0, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0,
      grounded: true, cooldown: 0, active: false, instinct: '', resistance: 1, checkpoint: 0,
      finishTime: null, wildline: freshWildline(), stats: newStats() }
    const driver: Driver = { body, collider, grid: index, peakY: 0, state, control: idleInput(),
      pressed: { jump: false, ability: false, interact: false }, power: 0, stun: 0, instinctTime: 0,
      instinctLock: 0, holding: null, heldBy: null, seenPickups: new Set() }
    this.drivers.set(id, driver)
    this.contacts.set(collider.handle, driver)
    this.spawn(driver)
  }

  remove(id: string) {
    const d = this.drivers.get(id)
    if (!d) return
    this.release(d)
    this.contacts.delete(d.collider.handle)
    this.world.removeRigidBody(d.body)
    this.drivers.delete(id)
  }

  select(id: string, animal: Animal) {
    const d = this.drivers.get(id)
    if (!d || d.state.animal === animal) return
    this.release(d)
    d.state.animal = animal
    d.collider.setMass(ANIMALS[animal].mass)
    d.state.cooldown = 0
    this.spawn(d)
  }

  reset() {
    this.ticks = 0
    this.previousEvent = null
    this.rainAge = 0
    for (const d of this.drivers.values()) {
      Object.assign(d.state, { checkpoint: 0, finishTime: null, cooldown: 0, stats: newStats(), wildline: freshWildline(), resistance: 1 })
      d.control = idleInput()
      d.pressed = { jump: false, ability: false, interact: false }
      d.seenPickups.clear()
      this.spawn(d)
    }
  }

  private spawn(d: Driver) {
    this.release(d)
    const z = d.state.checkpoint === 0 ? START_Z - 3 * Math.floor(d.grid / 4) : CHECKPOINTS[d.state.checkpoint - 1] + 2
    const x = centerAt(z) + ((d.grid % 4) - 1.5) * 2.3
    const y = elevationAt(z) + FOOT + 0.05
    d.state.wildline.chain = 0
    d.state.wildline.burst = 0
    d.peakY = y
    d.body.setTranslation({ x, y, z }, true)
    d.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    d.power = d.stun = d.instinctTime = d.instinctLock = 0
    Object.assign(d.state, { x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, active: false, grounded: true, instinct: '' })
  }

  input(id: string, input: Input) {
    const d = this.drivers.get(id)
    if (!d || !input || ![input.x, input.z, input.yaw].every(Number.isFinite)) return
    // Latch press edges even if a packet releasing the key arrives before the simulation tick.
    for (const key of ['jump', 'ability', 'interact'] as const) {
      if (input[key] === true && !d.control[key]) d.pressed[key] = true
    }
    d.control = { x: clamp(input.x, -1, 1), z: clamp(input.z, -1, 1), yaw: input.yaw % (2 * Math.PI),
      jump: input.jump === true, sprint: input.sprint === true, ability: input.ability === true,
      interact: input.interact === true, resist: input.resist === true }
  }

  private release(d: Driver) {
    if (d.heldBy) {
      const carrier = this.drivers.get(d.heldBy)
      if (carrier) { carrier.holding = null; carrier.power = 0 }
      d.heldBy = null
    }
    if (d.holding) {
      const target = this.drivers.get(d.holding)
      if (target) target.heldBy = null
      d.holding = null
      d.power = 0
    }
  }

  private toss(d: Driver) {
    const target = d.holding && this.drivers.get(d.holding)
    if (!target) return
    this.release(d)
    const yaw = d.control.yaw
    target.body.setLinvel({ x: Math.sin(yaw) * ABILITIES.gorilla.throwSpeed, y: ABILITIES.gorilla.throwLift, z: Math.cos(yaw) * ABILITIES.gorilla.throwSpeed }, true)
    target.stun = ABILITIES.gorilla.throwStun
    d.state.stats.throws++
  }

  private instinct(d: Driver) {
    if (d.instinctLock > 0) return
    d.state.instinct = { elephant: 'Startled charge', penguin: 'Slide addiction',
      gorilla: 'Chest beat', turtle: 'Hide in shell' }[d.state.animal]
    d.instinctTime = 1.15
    d.instinctLock = 6
  }

  private special(d: Driver) {
    const s = d.state
    const kind = s.animal
    if (d.holding && d.pressed.ability) { this.toss(d); return }
    if (s.cooldown > 0 || (kind === 'gorilla' ? !d.pressed.interact : !d.pressed.ability)) return
    if (kind === 'gorilla') {
      const target = [...this.drivers.values()].filter(other => other !== d && !other.heldBy && !other.holding &&
        other.state.finishTime === null).map(other => ({ other,
          dist: Math.hypot(other.state.x - s.x, other.state.y - s.y, other.state.z - s.z) }))
        .filter(entry => entry.dist < ABILITIES.gorilla.grabRange).sort((a, b) => a.dist - b.dist)[0]?.other
      if (!target) return
      target.heldBy = s.id
      d.holding = target.state.id
      d.power = ABILITIES.gorilla.duration
    } else {
      d.power = ABILITIES[kind].duration
      if (kind === 'elephant') {
        const mass = d.body.mass()
        const blast = ABILITIES.elephant
        d.body.applyImpulse({ x: Math.sin(s.yaw) * blast.impulse * mass, y: mass * blast.lift, z: Math.cos(s.yaw) * blast.impulse * mass }, true)
        for (const target of this.drivers.values()) {
          if (target === d || target.state.finishTime !== null || target.heldBy) continue
          const dx = target.state.x - s.x, dz = target.state.z - s.z
          const dist = Math.hypot(dx, dz, target.state.y - s.y)
          if (dist < blast.blastRadius) {
            const shove = (blast.blastRadius - dist) * 2 + 3
            target.body.applyImpulse({ x: dx / Math.max(0.4, dist) * shove, y: blast.blastLift, z: dz / Math.max(0.4, dist) * shove }, true)
            target.stun = blast.hitStun
            this.instinct(target)
          }
        }
      }
    }
    s.cooldown = ANIMALS[kind].cooldown
    s.stats.abilities++
  }

  private drive(d: Driver) {
    const s = d.state, input = d.control
    const pos = d.body.translation()
    let v = d.body.linvel()
    const floor = this.world.castRay(new RAPIER.Ray(pos, { x: 0, y: -1, z: 0 }), FOOT + 0.18,
      true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, d.body)
    s.grounded = Boolean(floor && v.y < 2.6)
    s.cooldown = Math.max(0, s.cooldown - DT)
    s.wildline.burst = Math.max(0, s.wildline.burst - DT)
    d.power = Math.max(0, d.power - DT)
    d.stun = Math.max(0, d.stun - DT)
    d.instinctTime = Math.max(0, d.instinctTime - DT)
    d.instinctLock = Math.max(0, d.instinctLock - DT)
    if (d.instinctTime > 0 && input.resist && s.resistance >= 0.2) {
      s.resistance -= 0.2
      d.instinctTime = 0
    }
    if (d.instinctTime <= 0) s.instinct = ''
    s.resistance = Math.min(1, s.resistance + DT * 0.055)
    if (d.heldBy) {
      const carrier = this.drivers.get(d.heldBy)
      if (carrier && !(d.pressed.jump && carrier.power < ABILITIES.gorilla.duration - ABILITIES.gorilla.escapeDelay)) {
        const p = carrier.body.translation(), yaw = carrier.state.yaw
        d.body.setTranslation({ x: p.x + Math.sin(yaw) * 0.9, y: p.y + 1.75, z: p.z + Math.cos(yaw) * 0.9 }, true)
        d.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        return
      }
      this.release(d)
    }
    if (d.holding && d.power <= 0) this.release(d)
    if (d.stun > 0) return
    const mag = Math.hypot(input.x, input.z)
    const forward = Math.cos(input.yaw), lateral = Math.sin(input.yaw)
    const dx = (lateral * input.z - forward * input.x) / Math.max(1, mag)
    const dz = (forward * input.z + lateral * input.x) / Math.max(1, mag)
    if (mag > 0.02) {
      const diff = Math.atan2(dx, dz) - s.yaw
      const turn = d.power > 0 && (s.animal === 'turtle' || s.animal === 'penguin') ? ABILITIES[s.animal].turnSpeed : 11
      s.yaw += clamp(Math.atan2(Math.sin(diff), Math.cos(diff)), -turn * DT, turn * DT)
    }
    this.special(d)
    v = d.body.linvel()
    const spec = ANIMALS[s.animal]
    const zone = zoneAt(pos.z)
    const slick = s.animal === 'penguin' && (zone === 2 || zone === 4)
    let friction = 0.12
    if (slick) friction = ABILITIES.penguin.slickFriction
    if (s.animal === 'turtle' && d.power > 0) friction = ABILITIES.turtle.rollFriction
    d.collider.setFriction(friction)
    const mud = zone === 3 && !(pos.z > 720 && pos.z < 872 && Math.abs(pos.x - centerAt(pos.z) + 10.4) < 2.2)
    let speed = spec.topSpeed * (input.sprint ? 1.46 : 1) * (mud ? 0.76 : 1)
    let ax = dx, az = dz
    if (d.power > 0 && s.animal !== 'gorilla') {
      const downhill = clamp(elevationAt(pos.z - 4) - elevationAt(pos.z + 4), 0, 2)
      speed = ABILITIES[s.animal].speed
      if (s.animal !== 'elephant') speed += ABILITIES[s.animal].downhillGain * downhill
      if (mud && s.animal === 'penguin') speed *= ABILITIES.penguin.mudMultiplier
      ax = Math.sin(s.yaw); az = Math.cos(s.yaw)
    }
    if (s.animal === 'penguin' && zone === 4 && pos.z > 1016 && d.instinctLock <= 0) this.instinct(d)
    if (d.instinctTime > 0) {
      if (s.animal === 'elephant' || s.animal === 'penguin') {
        ax += Math.sin(s.yaw) * ABILITIES[s.animal].instinctBoost; az += Math.cos(s.yaw) * ABILITIES[s.animal].instinctBoost
      } else if (s.animal === 'turtle') speed *= ABILITIES.turtle.hideSpeed
      else if (s.animal === 'gorilla') speed *= ABILITIES.gorilla.instinctSpeed
    }
    if (s.wildline.burst > 0) speed += 6.5
    const traction = d.power > 0 || s.wildline.burst > 0 ? 34 : spec.acceleration * (s.grounded ? slick ? 1 : 1.35 : 0.52)
    const changeX = ax * speed - v.x, changeZ = az * speed - v.z
    const factor = Math.min(1, traction * DT / Math.max(0.001, Math.hypot(changeX, changeZ)))
    const jump = d.pressed.jump && s.grounded
    d.body.setLinvel({ x: v.x + changeX * factor, y: jump ? 9.2 : v.y, z: v.z + changeZ * factor }, true)
    if (jump) s.grounded = false
  }

  private obstacle(d: Driver, hazard: Hazard) {
    if (hazard.kind === 'banana') {
      if (d.seenPickups.has(hazard.id)) return
      d.seenPickups.add(hazard.id)
      d.state.cooldown = Math.max(0, d.state.cooldown - 2)
      const force = 3 * d.body.mass()
      d.body.applyImpulse({ x: Math.sin(d.state.yaw) * force, y: 0.2, z: Math.cos(d.state.yaw) * force }, true)
      return
    }
    const s = d.state, v = d.body.linvel()
    s.stats.collisions++
    if (s.animal === 'gorilla' && (hazard.kind === 'log' || hazard.kind === 'gate') && d.control.jump) {
      // Strong arms let a gorilla mantle a low obstruction by holding jump against it.
      d.body.setLinvel({ x: Math.sin(s.yaw) * ABILITIES.gorilla.mantleSpeed, y: ABILITIES.gorilla.mantleLift, z: Math.cos(s.yaw) * ABILITIES.gorilla.mantleSpeed }, true)
    } else if (s.animal === 'turtle' && d.power > 0) {
      d.body.setLinvel({ x: -Math.sin(s.yaw) * 8 + 3, y: 3, z: -Math.cos(s.yaw) * 6 }, true)
      d.stun = ABILITIES.turtle.wallStun
    } else if (hazard.kind === 'peel') {
      d.body.setLinvel({ x: v.x + (Math.cos(s.yaw) * 4), y: 2, z: v.z }, true)
      d.stun = 0.28
    } else {
      d.stun = s.animal === 'elephant' && d.power > 0 ? ABILITIES.elephant.wallStun : 0.22
      d.power = 0
    }
    this.instinct(d)
  }

  private collide(a: Driver, b: Driver) {
    const sa = a.state, sb = b.state
    if (a.heldBy || b.heldBy || a.holding === sb.id || b.holding === sa.id) return
    if (sa.finishTime !== null || sb.finishTime !== null) return
    const speed = Math.hypot(sa.vx - sb.vx, sa.vz - sb.vz)
    if (speed < 2.2 && a.power <= 0 && b.power <= 0) return
    sa.stats.collisions++; sb.stats.collisions++
    for (const [source, target] of [[a, b], [b, a]]) {
      const power = source.power > 0 && source.state.animal !== 'gorilla'
      const dx = target.state.x - source.state.x, dz = target.state.z - source.state.z
      const length = Math.max(0.1, Math.hypot(dx, dz))
      const armor = target.state.animal === 'turtle' ? ABILITIES.turtle.armor : 1
      const impulse = Math.min(12, (speed * 0.25 + (power ? 5 : 0)) * Math.sqrt(source.body.mass())) * armor
      target.body.applyImpulse({ x: dx / length * impulse, y: power ? 2 : 0.3, z: dz / length * impulse }, true)
      if (power || speed > 9) this.instinct(target)
    }
  }

  private tickRain() {
    for (const d of this.drivers.values()) {
      for (let i = 0; i < 21; i++) {
        const id = 'rain-' + i
        if (d.seenPickups.has(id)) continue
        const drop = rainDrop(i, this.rainCenterZ, this.rainAge)
        if (drop.landed && Math.hypot(drop.x - d.state.x, drop.z - d.state.z) < 1.35 &&
            Math.abs(drop.y - d.state.y) < 1.8) {
          d.seenPickups.add(id)
          const v = d.body.linvel()
          d.body.setLinvel({ x: v.x + (i % 2 ? 5 : -5), y: 2, z: v.z }, true)
          d.stun = 0.26
          d.state.stats.collisions++
          this.instinct(d)
        }
      }
    }
  }

  private updateState(d: Driver, racing: boolean) {
    const s = d.state, p = d.body.translation(), v = d.body.linvel()
    if (Number.isFinite(p.y)) {
      d.peakY = Math.max(d.peakY, p.y)
      if (!s.grounded || s.vy < -1) s.stats.biggestFall = Math.max(s.stats.biggestFall, d.peakY - p.y)
      if (s.grounded) d.peakY = p.y
    }
    if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite) || p.y < elevationAt(p.z) - 8 ||
        p.z < -30 || Math.abs(p.x - centerAt(p.z)) > 48) {
      s.stats.falls++
      this.spawn(d)
      return
    }
    const speed = Math.hypot(v.x, v.z), factor = Math.min(1, 32 / Math.max(1, speed))
    if (factor < 1 || Math.abs(v.y) > 23) d.body.setLinvel({ x: v.x * factor, y: clamp(v.y, -23, 23), z: v.z * factor }, true)
    if (racing && s.finishTime === null) {
      crossWildline(s.wildline, s, p)
      const gate = CHECKPOINTS[s.checkpoint]
      const fraction = gateCrossing(s.checkpoint, s, p)
      if (fraction !== null) {
        s.checkpoint++
        if (s.checkpoint === CHECKPOINTS.length) {
          s.finishTime = (this.ticks - 1 + fraction) * DT
          this.release(d)
        }
      } else if (p.z > gate + 8) {
        s.stats.falls++
        this.spawn(d)
        return
      }
    }
    if (!racing && p.z > 45) { this.spawn(d); return }
    s.stats.backward += Math.max(0, s.z - p.z)
    if (!s.grounded) s.stats.airborne += DT
    Object.assign(s, { x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, active: d.power > 0 })
  }

  step(phase: Phase, event: RaceEvent | null = null) {
    if (phase === 'COUNTDOWN' || phase === 'RESULTS') return
    const racing = phase === 'RACING'
    this.ticks++
    this.world.gravity = { x: 0, y: event === 'lowGravity' ? -9.3 : -24, z: 0 }
    const racers = [...this.drivers.values()].map(d => d.state)
    for (const { patch, body } of this.decks) {
      body.setNextKinematicTranslation({ x: patch.x, y: patch.y - 0.42 - bridgeSag(patch.z, racers), z: patch.z })
    }
    for (const { hazard, body } of this.props) {
      if (!hazard.rate) continue
      const pose = hazardPose(hazard, racing ? this.ticks * DT : 0)
      body.setNextKinematicTranslation(pose)
      body.setNextKinematicRotation(yRotation(pose.yaw))
    }
    if (event === 'bananaRain') {
      if (this.previousEvent !== event) {
        this.rainCenterZ = Math.min(CHECKPOINTS.at(-1)! - 65, Math.max(0, ...racers.filter(s => s.finishTime === null).map(s => s.z)))
        this.rainAge = 0
      }
      this.rainAge += DT
      this.tickRain()
    }
    this.previousEvent = event
    for (const d of this.drivers.values()) {
      if (d.state.finishTime === null) this.drive(d)
      else d.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      d.pressed.jump = d.pressed.interact = d.pressed.ability = false
    }
    this.world.step(this.queue)
    this.queue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return
      const a = this.contacts.get(h1), b = this.contacts.get(h2)
      if (a && b) this.collide(a, b)
      else {
        const d = a ?? b, hazard = this.obstacles.get(a ? h2 : h1)
        if (d && hazard && d.state.finishTime === null) this.obstacle(d, hazard)
      }
    })
    for (const d of this.drivers.values()) this.updateState(d, racing)
  }

  players(): Racer[] {
    return [...this.drivers.values()].map(({ state }) => ({ ...state, stats: { ...state.stats }, wildline: { ...state.wildline } }))
  }

  dispose() { this.queue.free(); this.world.free(); this.drivers.clear(); this.contacts.clear() }
}
