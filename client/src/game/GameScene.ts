import * as T from 'three'
import type { Player, Snapshot } from '../../../shared/src/protocol.js'
import {
  centerAt,
  elevationAt,
  halfWidthAt,
} from '../../../shared/src/track.js'
import { AnimalModel } from './Animals.js'
import { course, menuDiorama, shadow, sky } from './Scenery.js'
import { pebble } from './Art.js'

const vec = new T.Vector3(),
  target = new T.Vector3(),
  focus = new T.Vector3(),
  particleMatrix = new T.Object3D()
const lerp = T.MathUtils.lerp
const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a))
type Actor = {
  model: AnimalModel
  blob: T.Mesh
  name: HTMLElement
  state: Player
  displayed: T.Vector3
  last: T.Vector3
  latest: T.Vector3
  hit: number
  lastPuff: number
}
class Particles {
  readonly mesh: T.InstancedMesh
  private slots = Array.from({ length: 84 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 2,
    life: 0.6,
    size: 0.2,
  }))
  private next = 0
  constructor() {
    this.mesh = new T.InstancedMesh(
      pebble,
      new T.MeshStandardMaterial({ flatShading: true, roughness: 1 }),
      this.slots.length,
    )
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage)
    this.slots.forEach((_, i) => this.mesh.setColorAt(i, new T.Color(0xffffff)))
  }
  burst(
    pos: T.Vector3,
    colour: string,
    count: number,
    size: number,
    speed: number,
    tail: number,
    yaw: number,
  ) {
    for (let i = 0; i < count; i++) {
      const index = this.next++ % this.slots.length,
        s = this.slots[index]
      s.x = pos.x - Math.sin(yaw) * tail + (Math.random() - 0.5) * 0.5
      s.y = pos.y + 0.2 + Math.random() * 0.42
      s.z = pos.z - Math.cos(yaw) * tail + (Math.random() - 0.5) * 0.5
      s.vx = (Math.random() - 0.5) * speed - Math.sin(yaw) * tail * 2
      s.vy = 0.65 + Math.random() * 1.15
      s.vz = (Math.random() - 0.5) * speed - Math.cos(yaw) * tail * 2
      s.age = 0
      s.life = 0.35 + Math.random() * 0.42
      s.size = size * (0.6 + Math.random() * 0.8)
      this.mesh.setColorAt(index, new T.Color(colour))
    }
    this.mesh.instanceColor!.needsUpdate = true
    this.mesh.count = this.slots.length
  }
  update(dt: number) {
    this.slots.forEach((s, i) => {
      if (s.age <= s.life) {
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.z += s.vz * dt
      }
      s.age += dt
      particleMatrix.position.set(s.x, s.y, s.z)
      particleMatrix.scale.setScalar(
        s.age < s.life
          ? s.size * Math.sin(Math.PI * (0.22 + (0.77 * s.age) / s.life))
          : 0,
      )
      particleMatrix.updateMatrix()
      this.mesh.setMatrixAt(i, particleMatrix.matrix)
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }
  clear() {
    this.slots.forEach((s) => (s.age = 2))
    this.mesh.count = 0
  }
}

export class GameScene {
  private readonly scene = new T.Scene()
  private readonly camera = new T.PerspectiveCamera(49, 1, 0.13, 260)
  private readonly renderer: T.WebGLRenderer
  private readonly light: T.DirectionalLight
  private readonly diorama = menuDiorama()
  private track?: ReturnType<typeof course>
  private readonly actors = new Map<string, Actor>()
  private readonly labels = document.createElement('div')
  private readonly particles = new Particles()
  private readonly observer: ResizeObserver
  private readonly abort = new AbortController()
  private readonly env = new T.Group()
  private snapshot: Snapshot | null = null
  private selfId = ''
  private distance = 7.7
  private paused = false
  private captured: number | null = null
  private pitch = 0.3
  private lastDrag = -100
  private received = 0
  private frame = 0
  private lastTime = 0
  private lastInteraction = 0
  private lastShadow = -1
  private lastQualityChange = 0
  private slowFrames = 0
  private quality = 1
  private readonly software: boolean
  private localTime = 0
  private warming = true
  private width = 1
  private height = 1
  yaw = 0
  constructor(private readonly container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    const gl = this.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info')
    const device = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : ''
    this.software = /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(
      device,
    )
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.domElement.style.cssText =
      'display:block;width:100%;height:100%;touch-action:none'
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Jungle Breakdown, 3D race course',
    )
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFShadowMap
    this.labels.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;'
    container.append(this.renderer.domElement, this.labels)
    this.light = sky(this.scene)
    this.scene.add(this.diorama.group, this.env)
    this.env.add(this.particles.mesh)
    this.env.visible = false
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
    const canvas = this.renderer.domElement,
      listen = { signal: this.abort.signal }
    const activity = () => {
      this.lastInteraction = performance.now() / 1000
    }
    window.addEventListener('pointerdown', activity, listen)
    window.addEventListener('keydown', activity, listen)
    window.addEventListener('focus', activity, listen)
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.snapshot || this.paused) return
        this.captured = e.pointerId
        this.lastDrag = this.localTime
        canvas.setPointerCapture(e.pointerId)
      },
      listen,
    )
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.captured !== e.pointerId || this.paused) return
        this.yaw -= e.movementX * 0.005
        this.pitch = T.MathUtils.clamp(
          this.pitch + e.movementY * 0.003,
          0.1,
          1.04,
        )
        this.lastDrag = this.localTime
      },
      listen,
    )
    const release = () => {
      this.captured = null
    }
    canvas.addEventListener('pointerup', release, listen)
    canvas.addEventListener('pointercancel', release, listen)
    canvas.addEventListener('lostpointercapture', release, listen)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), listen)
    this.frame = requestAnimationFrame(this.animate)
  }
  setMenu() {
    this.snapshot = null
    this.env.visible = false
    this.diorama.group.visible = true
    this.warming = true
    this.yaw = 0
    this.lastDrag = -100
    for (const id of this.actors.keys()) this.drop(id)
    this.particles.clear()
    this.camera.fov = 49
    this.camera.updateProjectionMatrix()
  }
  setDistance(distance: number) {
    this.distance = T.MathUtils.clamp(distance, 4, 12)
  }
  setPaused(paused: boolean) {
    this.paused = paused
    if (paused) this.captured = null
  }
  setSnapshot(snapshot: Snapshot, selfId: string) {
    const first = !this.snapshot
    if (!this.track) {
      this.track = course()
      this.env.add(this.track.group)
    }
    if (
      first ||
      (snapshot.phase === 'COUNTDOWN' && this.snapshot?.phase !== 'COUNTDOWN')
    ) {
      this.yaw = 0
      this.pitch = 0.3
      this.warming = true
      this.particles.clear()
    }
    this.snapshot = snapshot
    this.selfId = selfId
    this.received = performance.now() / 1000
    this.env.visible = true
    this.diorama.group.visible = false
    const seen = new Set<string>()
    for (const p of snapshot.players) {
      seen.add(p.id)
      let actor = this.actors.get(p.id)
      if (actor && actor.state.animal !== p.animal) {
        this.drop(p.id)
        actor = undefined
      }
      if (!actor) {
        const model = new AnimalModel(p.animal),
          blob = shadow(),
          name = document.createElement('span')
        name.textContent = p.name
        name.style.cssText =
          'position:absolute;top:0;left:0;background:#193b32e6;color:#fff4da;border-radius:4px;padding:3px 7px;font:700 11px system-ui;white-space:nowrap;will-change:transform;'
        this.labels.append(name)
        this.env.add(model.group, blob)
        const latest = new T.Vector3(p.x, p.y, p.z)
        actor = {
          model,
          blob,
          name,
          state: p,
          displayed: latest.clone(),
          last: latest.clone(),
          latest,
          hit: 0,
          lastPuff: -1,
        }
        this.actors.set(p.id, actor)
      } else {
        actor.last.copy(actor.latest)
        actor.latest.set(p.x, p.y, p.z)
        if (actor.latest.distanceToSquared(actor.last) > 100) {
          actor.last.copy(actor.latest)
          actor.displayed.copy(actor.latest)
          if (p.id === selfId) this.warming = true
        }
        if (p.stats.collisions > actor.state.stats.collisions) {
          actor.hit = 1
          this.particles.burst(actor.displayed, '#ffdd66', 8, 0.18, 4, 0, p.yaw)
        }
        if (p.active && !actor.state.active && p.animal === 'elephant')
          this.particles.burst(
            actor.displayed,
            '#a2c85a',
            16,
            0.48,
            5,
            1,
            p.yaw,
          )
        actor.state = p
      }
    }
    for (const id of this.actors.keys()) if (!seen.has(id)) this.drop(id)
  }
  private drop(id: string) {
    const a = this.actors.get(id)
    if (!a) return
    this.env.remove(a.model.group, a.blob)
    a.blob.geometry.dispose()
    a.name.remove()
    this.actors.delete(id)
  }
  private resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight
    if (!w || !h) return
    this.width = w
    this.height = h
    const pixelBudget = this.software ? 540000 : 2100000
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.6, Math.sqrt(pixelBudget / (w * h))) *
        this.quality,
    )
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
  private animate = (ms: number) => {
    this.frame = requestAnimationFrame(this.animate)
    if (document.hidden || !this.height) return
    const t = ms / 1000,
      delta = t - (this.lastTime || t),
      active = t - this.lastInteraction < 5
    const isRace = this.snapshot?.phase === 'RACING',
      unfocused = !document.hasFocus()
    const fps = unfocused
      ? 3
      : this.software
        ? isRace
          ? 24
          : active
            ? 15
            : 6
        : isRace
          ? 60
          : active
            ? 40
            : 24
    if (this.lastTime && delta < 1 / fps - 0.001) return
    const dt = Math.min(0.14, Math.max(0, delta))
    this.lastTime = t
    this.localTime = t
    if (!unfocused && isRace) {
      this.slowFrames =
        delta > (1 / fps) * 1.65
          ? this.slowFrames + 1
          : Math.max(0, this.slowFrames - 1)
      if (
        this.slowFrames > 8 &&
        t - this.lastQualityChange > 3 &&
        this.quality > 0.61
      ) {
        this.quality = Math.max(0.6, this.quality - 0.14)
        this.resize()
        this.slowFrames = 0
        this.lastQualityChange = t
      }
    }
    if (
      t - this.lastShadow > (isRace ? 0.08 : 0.35) ||
      (this.snapshot && this.warming)
    ) {
      this.renderer.shadowMap.needsUpdate = true
      this.lastShadow = t
    }
    if (!this.snapshot) {
      this.diorama.update(t)
      const distance = Math.max(8.55, 8.45 / this.camera.aspect)
      this.camera.position.set(0.76 + Math.sin(t * 0.19) * 0.16, 2.74, distance)
      this.camera.lookAt(-0.2, 1.72, -0.1)
      this.camera.rotateZ(-0.024)
      this.light.position.set(-9, 15, 8)
      this.light.target.position.set(0, 0, -2)
    } else {
      const who = this.actors.get(this.selfId)
      if (!who) return
      const gap = Math.max(0, t - this.received)
      this.track?.stream(who.state.z)
      const event = this.snapshot.event
      this.track?.update(
        this.snapshot.phase === 'RACING'
          ? this.snapshot.elapsed + Math.min(0.12, gap)
          : this.snapshot.elapsed,
        event?.stage === 'active' ? event.kind : null,
        event?.centerZ ?? who.state.z,
        8 - (event?.remaining ?? 8) + Math.min(0.12, gap),
        this.snapshot.players,
      )
      for (const actor of this.actors.values())
        this.moveActor(actor, t, dt, gap)
      this.follow(who, t, dt)
      this.camera.updateMatrixWorld()
      for (const a of this.actors.values()) {
        if (a.state.id === this.selfId) {
          a.name.hidden = true
          continue
        }
        vec.copy(a.displayed)
        vec.y += a.state.animal === 'turtle' ? 0.9 : 1.88
        vec.project(this.camera)
        const visible =
          vec.z > 0 && vec.z < 1 && Math.abs(vec.x) < 1.1 && Math.abs(vec.y) < 1
        a.name.hidden = !visible
        if (visible)
          a.name.style.transform =
            'translate(' +
            (vec.x * 0.5 + 0.5) * this.width +
            'px,' +
            (0.5 - vec.y * 0.5) * this.height +
            'px) translate(-50%,-100%)'
      }
      this.particles.update(dt)
    }
    this.renderer.render(this.scene, this.camera)
  }
  private moveActor(a: Actor, t: number, dt: number, gap: number) {
    const p = a.state
    if (p.id === this.selfId) {
      const ahead = Math.min(gap, 0.075)
      vec.set(p.x + p.vx * ahead, p.y + p.vy * ahead, p.z + p.vz * ahead)
      a.displayed.lerp(vec, 1 - Math.exp(-dt * 35))
    } else a.displayed.lerpVectors(a.last, a.latest, Math.min(1, gap * 15))
    const ground = elevationAt(a.displayed.z)
    const surface =
      halfWidthAt(a.displayed.z) < 6 &&
      Math.abs(a.displayed.x - centerAt(a.displayed.z)) > 6
        ? ground - 3.3
        : ground
    const footY = a.displayed.y - 0.84
    a.model.group.position.set(a.displayed.x, footY, a.displayed.z)
    a.model.group.rotation.y +=
      angleDelta(a.model.group.rotation.y, p.yaw) * (1 - Math.exp(-dt * 16))
    const speed = Math.hypot(p.vx, p.vz)
    a.hit = Math.max(0, a.hit - dt * 3.8)
    a.model.pose(
      t + this.snapshot!.players.indexOf(p),
      Math.min(1, speed * 0.24),
      p.active,
      !p.grounded,
      a.hit,
    )
    a.blob.visible =
      Math.abs(a.displayed.x - centerAt(a.displayed.z)) <
      Math.max(halfWidthAt(a.displayed.z), 12.4)
    a.blob.position.set(
      a.displayed.x,
      Math.min(footY, surface) + 0.055,
      a.displayed.z,
    )
    a.blob.scale.setScalar(Math.max(0.3, 1 - (footY - surface) * 0.075))
    if (
      (p.active || (speed > 5 && p.grounded)) &&
      t - a.lastPuff > (p.active ? 0.09 : 0.18)
    ) {
      const colour = p.active
        ? {
            elephant: '#a6c65e',
            penguin: '#d4f6f2',
            gorilla: '#ffcd71',
            turtle: '#d6ca8b',
          }[p.animal]
        : '#f3d49b'
      this.particles.burst(
        a.model.group.position,
        colour,
        p.active ? 3 : 1,
        p.active ? 0.29 : 0.14,
        1.8,
        1,
        p.yaw,
      )
      a.lastPuff = t
    }
  }
  private follow(a: Actor, t: number, dt: number) {
    if (!this.paused && this.captured === null && t - this.lastDrag > 1.2) {
      // Center the view on the course, independently of the direction of a strafe.
      this.yaw += angleDelta(this.yaw, 0) * (1 - Math.exp(-dt * 1.05))
      this.pitch = lerp(this.pitch, 0.3, 1 - Math.exp(-dt * 0.7))
    }
    focus.copy(a.displayed)
    focus.y += 0.69
    const length = this.distance * Math.cos(this.pitch)
    target.set(
      focus.x - Math.sin(this.yaw) * length,
      focus.y + Math.sin(this.pitch) * this.distance,
      focus.z - Math.cos(this.yaw) * length,
    )
    target.y = Math.max(target.y, elevationAt(target.z) + 1)
    const obstructed = this.track?.avoidObstacle(focus, target)
    if (this.warming || obstructed) {
      this.camera.position.copy(target)
      this.warming = false
    } else this.camera.position.lerp(target, 1 - Math.exp(-dt * 11))
    if (a.hit > 0.2 && this.snapshot?.phase === 'RACING') {
      this.camera.position.x += Math.sin(t * 59) * 0.06 * a.hit
    }
    focus.y += 0.35
    focus.x += Math.sin(this.yaw) * 1.8
    focus.z += Math.cos(this.yaw) * 1.8
    this.camera.lookAt(focus)
    const fov = lerp(
      this.camera.fov,
      a.state.active ? 62 : 52,
      1 - Math.exp(-dt * 4),
    )
    if (Math.abs(fov - this.camera.fov) > 0.004) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    this.light.position.copy(a.displayed).add(vec.set(-9, 16, 8))
    this.light.target.position.copy(a.displayed)
  }
  dispose() {
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.abort.abort()
    for (const id of this.actors.keys()) this.drop(id)
    this.labels.remove()
    this.renderer.domElement.remove()
    this.renderer.dispose()
  }
}
