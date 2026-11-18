import type { Animal, Snapshot } from '@beast/shared/protocol'

type Mix = { music: number; sfx: number; announcer: number; muted: boolean }
type Bus = 'music' | 'sfx' | 'announcer'

/** A small original percussion and marimba score, synthesized entirely on the device. */
export class GameAudio {
  private ctx?: AudioContext
  private buses?: Record<Bus, GainNode>
  private mix: Mix = { music: 0.55, sfx: 0.75, announcer: 0.75, muted: false }
  private beat = 0
  private nextBeat = 0
  private stepAt = 0
  private previous?: Snapshot
  private timer?: number

  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext() } catch { return }
      const bus = () => { const gain = this.ctx!.createGain(); gain.connect(this.ctx!.destination); return gain }
      this.buses = { music: bus(), sfx: bus(), announcer: bus() }
      this.configure(this.mix)
      this.timer = window.setInterval(() => this.music(), 90)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
  }

  configure(settings: Mix) {
    this.mix = settings
    if (!this.ctx || !this.buses) return
    for (const bus of ['music', 'sfx', 'announcer'] as const) {
      this.buses[bus].gain.setTargetAtTime(settings.muted ? 0 : settings[bus], this.ctx.currentTime, 0.03)
    }
  }

  private note(bus: Bus, pitch: number, end: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (!this.ctx || !this.buses || this.ctx.state !== 'running' || this.mix.muted || !this.mix[bus]) return
    const start = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator(), envelope = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(pitch, start)
    osc.frequency.exponentialRampToValueAtTime(end, start + duration)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(envelope).connect(this.buses[bus])
    osc.onended = () => { osc.disconnect(); envelope.disconnect() }
    osc.start(start); osc.stop(start + duration + 0.01)
  }

  private music() {
    if (!this.ctx || document.hidden || this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    this.nextBeat = Math.max(now, this.nextBeat)
    while (this.nextBeat < now + 0.13) {
      const t = this.nextBeat - now, i = this.beat % 16
      const pitch = [392, 0, 493.88, 587.33, 0, 440, 392, 0, 329.63, 0, 392, 493.88, 440, 0, 293.66, 0][i]
      if (pitch) this.note('music', pitch, pitch * 0.996, 0.22, 'sine', 0.072, t)
      if (i % 4 === 0) this.note('music', i < 8 ? 98 : 82.41, 51, 0.19, 'triangle', 0.1, t)
      if (i % 4 === 2) this.note('music', 660, 210, 0.04, 'triangle', 0.032, t)
      this.beat++; this.nextBeat += this.previous?.phase === 'RACING' ? 0.21 : 0.255
    }
  }

  private special(animal: Animal) {
    if (animal === 'elephant') {
      for (let i = 0; i < 4; i++) this.note('sfx', 98 - i * 8, 38, 0.2, 'sawtooth', 0.085, i * 0.07)
    } else if (animal === 'penguin') this.note('sfx', 1120, 190, 0.6, 'triangle', 0.11)
    else if (animal === 'gorilla') this.note('sfx', 130, 580, 0.3, 'sawtooth', 0.07)
    else for (let i = 0; i < 5; i++) this.note('sfx', 250 + i * 34, 105, 0.12, 'triangle', 0.13, i * 0.075)
  }

  snapshot(frame: Snapshot, id: string) {
    const prev = this.previous, me = frame.players.find(p => p.id === id)
    this.previous = frame
    if (!me) return
    if (frame.phase === 'COUNTDOWN' && frame.countdown !== prev?.countdown) this.note('announcer', 555, 555, 0.18, 'square', 0.075)
    if (frame.phase === 'RACING' && prev?.phase === 'COUNTDOWN') this.note('announcer', 740, 1100, 0.43, 'triangle', 0.18)
    if (frame.event && frame.event.stage !== prev?.event?.stage) {
      for (const [i, p] of [494, 622, 740].entries()) this.note('announcer', p, p, 0.19, 'triangle', 0.15, i * 0.1)
    }
    if (frame.phase === 'RESULTS' && prev?.phase !== 'RESULTS') {
      for (const [i, p] of [392, 494, 587, 784].entries()) this.note('announcer', p, p, 0.35, 'triangle', 0.2, i * 0.11)
    }
    if (!prev || prev.phase !== frame.phase || document.hidden) return
    for (const racer of frame.players) {
      if (Math.hypot(racer.x - me.x, racer.z - me.z) > 16) continue
      const old = prev.players.find(p => p.id === racer.id)
      if (old && racer.stats.abilities > old.stats.abilities) this.special(racer.animal)
    }
    const old = prev.players.find(p => p.id === id)
    if (!old) return
    if (me.stats.collisions > old.stats.collisions) this.note('sfx', 164, 42, 0.22, 'square', 0.10)
    if (me.grounded !== old.grounded) {
      if (me.grounded) this.note('sfx', 125, 38, 0.1, 'triangle', 0.22)
      else if (me.vy > 2) this.note('sfx', 205, 590, 0.19, 'sine', 0.13)
    }
    const now = performance.now()
    if (me.grounded && Math.hypot(me.vx, me.vz) > 1.5 && now > this.stepAt) {
      this.note('sfx', me.animal === 'elephant' ? 83 : 154, 49, 0.07, 'triangle', 0.09)
      this.stepAt = now + 285
    }
  }

  menu() { this.previous = undefined }
  dispose() { clearInterval(this.timer); void this.ctx?.close() }
}
