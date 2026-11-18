import type { Snapshot, Player } from '@beast/shared/protocol'
import { ANIMALS } from '@beast/shared/animals'
import {
  FINISH_Z,
  ZONES,
  CHECKPOINTS,
  zoneAt,
  centerAt,
} from '@beast/shared/track'
import {
  WILDLINE_GATES,
  WILDLINE_BURST_INTERVAL,
} from '@beast/shared/wildlines'
import { STEAM_VENTS, ventState } from '@beast/shared/vents'
import { icon } from './icons.js'
import { ordinal, raceTime, escapeText } from './Cup.js'

export function broadcastMarkup(s: Snapshot) {
  return `<div class="broadcast" id="broadcast">
    <header class="broadcast-top"><section class="timing-tower"><div class="timing-head">
      <div class="placing"><b id="place"></b><small id="field"></small></div>
      <div class="stage-info"><span>${s.cup ? 'Wildline Cup' : s.practice ? 'Solo practice' : 'Private race'}</span><strong id="zone"></strong></div>
    </div><ol class="rivals" id="rivals" aria-label="Race standings"></ol></section>
    <div class="stage-clock">${icon('clock', 16)}<b id="timer"></b><button class="broadcast-pause" data-action="pause" aria-label="Race menu">${icon('pause', 15)}</button></div></header>
    <div class="broadcast-call" id="event" role="status"></div><div id="count" class="start-count" aria-live="polite"></div>
    <div class="race-instruction" id="coach"></div>
    <footer class="instrument-panel">
    <div class="telemetry"><div class="speed"><strong id="speed"></strong><small>km/h</small></div>
      <div class="distance"><div class="gauge-ticks" id="gauge-ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div><span id="checks"></span><b id="direction"></b></div><progress max="1" id="progress" aria-label="Course progress"></progress></div></div>
    <div class="ability-module"><div class="ability-readout"><kbd id="ability-key"></kbd><strong id="ability"></strong><b id="cool"></b></div>
    <div class="instinct-readout"><span id="instinct"></span><progress id="resist" aria-label="Instinct resistance" max="1"></progress></div></div></footer>
    <div class="line-meter"><span class="line-emblem">${icon('gate', 22)}</span><div><small>Wildline <b id="gate-range"></b></small>
      <div class="charge-pips" id="charge-pips"><i></i><i></i><i></i></div></div><b id="chain"></b></div>
  </div>`
}

export class Broadcast {
  private readonly nodes = new Map<string, HTMLElement>()
  private order = ''
  private lastGate = -1
  private lastCheckpoint = 0
  private lastFall = 0
  private lastVent = 0
  private call = ''
  private callStyle = ''
  private until = 0
  constructor(surface: HTMLElement) {
    surface
      .querySelectorAll<HTMLElement>('[id]')
      .forEach((el) => this.nodes.set(el.id, el))
  }
  private text(id: string, value: string) {
    const element = this.nodes.get(id)!
    if (element.textContent !== value) element.textContent = value
  }
  private meter(id: string, value: number) {
    const element = this.nodes.get(id) as HTMLProgressElement
    element.value = Math.max(0, Math.min(1, value))
  }
  private announce(text: string, css: string, elapsed: number) {
    this.call = text
    this.callStyle = css
    this.until = elapsed + 1.85
  }
  update(s: Snapshot, me: Player) {
    const zone = ZONES[zoneAt(me.z)]
    const skill = me.wildline
    const gate = WILDLINE_GATES[skill.lastGate + 1]
    this.text('place', ordinal(me.place))
    this.text('field', '/ ' + s.players.length)
    this.text('zone', zone.name)
    this.text('timer', raceTime(s.elapsed, true))
    this.text('speed', Math.round(Math.hypot(me.vx, me.vz) * 3.6).toString())
    this.text(
      'checks',
      me.checkpoint + ' / ' + CHECKPOINTS.length + ' checkpoints',
    )
    this.meter('progress', me.z / FINISH_Z)
    const ticks = this.nodes.get('gauge-ticks')!
    ticks.style.setProperty(
      '--rev',
      Math.min(100, Math.hypot(me.vx, me.vz) * 5) + '%',
    )
    const touch = document.body.classList.contains('touch-driving')
    const grab = me.animal === 'gorilla'
    this.text('ability-key', grab && !me.active ? 'F' : 'E')
    this.text(
      'ability',
      grab && me.active ? 'Throw racer' : ANIMALS[me.animal].special,
    )
    this.text(
      'cool',
      me.active
        ? 'Active'
        : me.cooldown > 0.05
          ? Math.ceil(me.cooldown) + 's'
          : 'Ready',
    )
    this.text(
      'instinct',
      me.instinct
        ? (touch ? 'Resist ' : 'Q · Resist ') + me.instinct
        : 'Instinct resistance',
    )
    this.meter('resist', me.resistance)
    const targetYaw = Math.atan2(centerAt(me.z + 10) - me.x, 10) - me.yaw
    const heading = Math.atan2(Math.sin(targetYaw), Math.cos(targetYaw))
    this.text(
      'direction',
      me.finishTime !== null
        ? 'Finished'
        : Math.abs(heading) > 1.8
          ? '↶ Turn back'
          : Math.abs(heading) > 0.38
            ? heading > 0
              ? '↖ Left'
              : '↗ Right'
            : '↑ Ahead',
    )
    const count =
      s.phase === 'COUNTDOWN'
        ? String(Math.max(1, Math.ceil(s.countdown)))
        : s.elapsed < 0.8
          ? 'GO!'
          : ''
    this.text('count', count)
    const boost = skill.burst > 0
    this.nodes.get('broadcast')!.classList.toggle('bursting', boost)
    this.text('chain', boost ? 'BURST' : '×' + skill.chain)
    const lit = boost
      ? WILDLINE_BURST_INTERVAL
      : skill.chain % WILDLINE_BURST_INTERVAL
    const pips = this.nodes.get('charge-pips')!
    if (pips.dataset.lit !== String(lit)) {
      pips.dataset.lit = String(lit)
      Array.from(pips.children).forEach((p, i) =>
        p.classList.toggle('lit', i < lit),
      )
    }
    const delta = gate ? gate.x - me.x : 0
    this.text(
      'gate-range',
      gate
        ? (Math.abs(delta) < gate.halfWidth ? '↑' : delta > 0 ? '↖' : '↗') +
            ' ' +
            Math.max(0, Math.round(gate.z - me.z)) +
            ' m'
        : 'Complete',
    )

    if (s.phase === 'RACING') {
      if (skill.lastGate > this.lastGate) {
        if (skill.verdict === 'hit')
          this.announce(
            boost ? 'Wildline burst!' : 'Clean gate  ×' + skill.chain,
            boost ? 'burst' : 'gold',
            s.elapsed,
          )
        else if (this.lastGate >= 0)
          this.announce('Gate missed', 'miss', s.elapsed)
      }
      if (me.checkpoint > this.lastCheckpoint)
        this.announce(
          'Checkpoint  ' + me.checkpoint + ' / ' + CHECKPOINTS.length,
          'checkpoint',
          s.elapsed,
        )
      if (me.stats.vents > this.lastVent)
        this.announce('Geyser launch!', 'checkpoint', s.elapsed)
      if (me.stats.falls > this.lastFall)
        this.announce('Back on track', 'checkpoint', s.elapsed)
    }
    this.lastGate = skill.lastGate
    this.lastCheckpoint = me.checkpoint
    this.lastFall = me.stats.falls
    this.lastVent = me.stats.vents
    const event = s.event
    const disaster = event
      ? (event.stage === 'warning' ? 'Incoming · ' : '') +
        (event.kind === 'lowGravity' ? 'Low gravity' : 'Banana rain') +
        ' · ' +
        Math.ceil(event.remaining) +
        's'
      : ''
    const celebrating = s.elapsed < this.until
    const call =
      me.finishTime !== null
        ? 'Across the line!'
        : celebrating
          ? this.call
          : disaster
    this.nodes.get('event')!.dataset.kind = celebrating
      ? this.callStyle
      : 'disaster'
    this.text('event', call)
    const coast = s.cup
      ? touch
        ? 'Steer with the pad · Pull back to brake'
        : 'Auto-run on · A / D steer · S brakes'
      : touch
        ? 'Use the pad to move'
        : 'WASD to run · Shift to sprint'
    const nearbyVent = STEAM_VENTS.find(
      (vent) => vent.z >= me.z && vent.z - me.z < 38,
    )
    const ventTip =
      nearbyVent && Math.abs(nearbyVent.x - me.x) < 14
        ? ventState(nearbyVent, s.elapsed).stage === 'erupting'
          ? 'Ride the steam plume for a launch'
          : 'Steam vent ahead · Cross as it erupts'
        : ''
    this.text(
      'coach',
      call || me.finishTime !== null
        ? ''
        : ventTip
          ? ventTip
          : s.elapsed < 7
            ? coast
            : s.elapsed < 16
              ? 'Three gold gates in a row trigger a burst'
              : s.elapsed < 24
                ? touch
                  ? 'Tap Jump to clear a gap · Special activates your ability'
                  : grab
                    ? 'F grabs a nearby racer · E throws'
                    : 'Space jumps · E activates ' + ANIMALS[me.animal].special
                : '',
    )
    const lineup =
      s.players.length > 1
        ? [...s.players].sort((a, b) => a.place - b.place)
        : []
    const signature = lineup
      .map((p) => [p.id, p.name, p.animal, p.place, p.bot].join(':'))
      .join('|')
    if (signature !== this.order) {
      this.order = signature
      this.nodes.get('rivals')!.innerHTML = lineup
        .map(
          (p) =>
            `<li class="${p.id === me.id ? 'your-row' : ''}" style="--coat:${ANIMALS[p.animal].color}"><b>${p.place}</b><i></i><span>${escapeText(p.name)}</span><small>${p.id === me.id ? 'YOU' : p.bot ? 'CPU' : ''}</small></li>`,
        )
        .join('')
    }
  }
}
