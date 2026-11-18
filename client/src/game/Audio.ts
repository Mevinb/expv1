import { FINISH_Z } from '@beast/shared/track'
import type { Animal, Snapshot } from '@beast/shared/protocol'

type Mix = { music: number; sfx: number; announcer: number; muted: boolean }
type Bus = 'music' | 'sfx' | 'announcer'

/** A small original percussion and marimba score, synthesized entirely on the device. */
export class GameAudio {
  private ctx?: AudioContext
  private buses?: Record<Bus, GainNode>
  private mix: Mix = { music: 0.55, sfx: 0.75, announcer: 0.75, muted: false }
  private noise?: AudioBuffer
  private finalStretch = false
  private streak = 0
  private beat = 0
  private nextBeat = 0
  private stepAt = 0
  private previous?: Snapshot
  private timer?: number

  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext() } catch { return }
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * .5, this.ctx.sampleRate)
      const samples = this.noise.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
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

  private percussion(bus: Bus, startIn: number, duration: number, frequency: number, amplitude: number, kind: BiquadFilterType = 'highpass') {
    if (!this.ctx || !this.noise || !this.buses || this.ctx.state !== 'running' || this.mix.muted || !this.mix[bus]) return
    const ctx = this.ctx, start = ctx.currentTime + startIn
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain()
    source.buffer = this.noise; source.loop = duration > this.noise.duration
    filter.type = kind; filter.frequency.value = frequency; filter.Q.value = .6
    amp.gain.setValueAtTime(.0001, start)
    amp.gain.exponentialRampToValueAtTime(amplitude, start + .012)
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration)
    source.connect(filter).connect(amp).connect(this.buses[bus])
    source.onended = () => { source.disconnect(); filter.disconnect(); amp.disconnect() }
    source.start(start); source.stop(start + duration + .015)
  }

  private music() {
    if (!this.ctx || document.hidden || this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    const racing = this.previous?.phase === 'RACING'
    this.nextBeat = Math.max(now, this.nextBeat)
    // Eighth-note samba bass and syncopated marimba. The last sector adds a
    // high answering voice and double hats without restarting the music clock.
    const roots = [55, 65.406, 43.654, 48.999]
    const motif = [12, -1, 19, 15, -1, 22, 19, -1, 12, 15, -1, 19, 24, -1, 19, 15]
    while (this.nextBeat < now + .14) {
      const t = this.nextBeat - now, i = this.beat % 16
      const root = roots[Math.floor(this.beat / 16) % roots.length]
      const swing = i % 2 ? .018 : 0
      const pitch = root * 2 * Math.pow(2, motif[i] / 12)
      if (motif[i] >= 0) {
        this.note('music', pitch, pitch * .999, .25, 'sine', .079, t + swing)
        this.note('music', pitch * 3, pitch * 2.95, .066, 'sine', .019, t + swing)
        if (this.finalStretch && i % 3 === 0) this.note('music', pitch * 1.5, pitch * 1.5, .19, 'triangle', .035, t + .088)
      }
      if (i % 4 === 0 || racing && i === 11) {
        this.note('music', root * (i === 8 ? 1.5 : 1), root, .28, 'triangle', .14, t)
        this.note('music', 132, 43, .16, 'sine', .20, t)
      }
      if (racing) {
        if (i % 4 === 2) this.percussion('music', t, .14, 1200, .11, 'bandpass')
        this.percussion('music', t + swing, i % 4 === 3 ? .12 : .045, 5300, i % 2 ? .05 : .035)
        if (this.streak >= 2 && i % 4 === 3) this.note('music', root * 8, root * 7.8, .085, 'triangle', .055, t + .10)
      }
      this.beat++
      this.nextBeat += racing ? (this.finalStretch ? .195 : .215) : .26
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
    this.finalStretch = frame.phase === 'RACING' && me.z >= FINISH_Z - 258
    this.streak = me.wildline.chain
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
      if (old && racer.stats.throws > old.stats.throws) {
        this.note('sfx', 280, 920, .14, 'sine', .16)
        this.note('sfx', 950, 185, .38, 'triangle', .13, .1)
      }
    }
    const old = prev.players.find(p => p.id === id)
    if (!old) return
    if (me.wildline.hits > old.wildline.hits) {
      const pitch = [523.25, 659.25, 783.99][(me.wildline.chain + 2) % 3]
      this.note('sfx', pitch, pitch, .34, 'sine', .22)
      this.note('sfx', pitch * 2, pitch * 2, .18, 'sine', .075, .027)
      if (me.wildline.burst > old.wildline.burst) {
        this.percussion('sfx', 0, .65, 1900, .17, 'bandpass')
        this.note('sfx', 100, 610, .36, 'triangle', .13)
      }
    }
    if (old.place > me.place && frame.elapsed > 3 && old.finishTime === null) {
      this.note('announcer', 330, 550, .12, 'triangle', .07)
    }
    if (me.checkpoint > old.checkpoint) {
      ;[392, 493.88, 659.25].forEach((p, i) => this.note('announcer', p, p, .3, 'triangle', .13, i * .085))
      this.percussion('announcer', .03, .65, 870, .10, 'bandpass')
    }
    if (me.stats.vents > old.stats.vents) {
      this.percussion('sfx', 0, .7, 1600, .18, 'bandpass')
      this.note('sfx', 165, 740, .42, 'sine', .17)
    }
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

  menu() { this.previous = undefined; this.finalStretch = false; this.streak = 0 }
  dispose() { clearInterval(this.timer); void this.ctx?.close() }
}
