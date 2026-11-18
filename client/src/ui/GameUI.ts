import type { Animal, Player, Snapshot } from '../../../shared/src/protocol.js'
import { ANIMALS, isAnimal } from '../../../shared/src/animals.js'
import {
  CHECKPOINTS,
  FINISH_Z,
  ZONES,
  centerAt,
  zoneAt,
} from '../../../shared/src/track.js'
import { animalPortrait } from '../game/Portrait.js'
import { icon, paw } from './icons.js'
import './style.css'

export interface Settings {
  music: number
  sfx: number
  announcer: number
  muted: boolean
  distance: number
}
export interface UIActions {
  create(name: string): void
  join(name: string, code: string): void
  practice(name: string): void
  select(animal: Animal): void
  ready(value: boolean): void
  start(): void
  rematch(): void
  lobby(): void
  leave(): void
  settings(value: Settings): void
  pause(value: boolean): void
}

type Screen = 'menu' | 'lobby' | 'race' | 'results'
type Overlay =
  | ''
  | 'create'
  | 'join'
  | 'practice'
  | 'settings'
  | 'controls'
  | 'pause'
const entries = Object.entries(ANIMALS) as [Animal, (typeof ANIMALS)[Animal]][]
const defaults: Settings = {
  music: 0.35,
  sfx: 0.72,
  announcer: 0.7,
  distance: 8,
  muted: false,
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  )
const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? n + 'th'
const stamp = (n: number) => String(n).padStart(2, '0')
const time = (seconds: number, detailed = false) => {
  const whole = Math.floor(Math.max(0, seconds) * 100)
  return (
    Math.floor(whole / 6000) +
    ':' +
    stamp(Math.floor(whole / 100) % 60) +
    (detailed ? '.' + stamp(whole % 100) : '')
  )
}
function load(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage is optional */
  }
}
function readSettings(): Settings {
  let saved: Partial<Settings> = {}
  try {
    saved = JSON.parse(load('beast-settings') ?? '{}') ?? {}
  } catch {
    /* reset invalid preferences */
  }
  const values = { ...defaults }
  for (const key of ['music', 'sfx', 'announcer', 'distance'] as const) {
    const value = saved[key]
    if (typeof value === 'number' && Number.isFinite(value))
      values[key] = Math.min(
        key === 'distance' ? 12 : 1,
        Math.max(key === 'distance' ? 4 : 0, value),
      )
  }
  values.muted = saved.muted === true
  return values
}
const controls = [
  ['W A S D', 'Move'],
  ['Drag mouse', 'Orbit camera'],
  ['Space', 'Jump'],
  ['Shift', 'Sprint'],
  ['E', 'Special ability / throw'],
  ['F', 'Grab / interact'],
  ['Q', 'Resist instinct'],
  ['Esc', 'Race menu'],
]
function action(
  name: string,
  label: string,
  mark: Parameters<typeof icon>[0],
  primary = false,
) {
  return (
    '<button class="action ' +
    (primary ? 'primary' : '') +
    '" data-action="' +
    name +
    '">' +
    icon(mark, 21) +
    '<span>' +
    label +
    '</span>' +
    icon('arrow', 19) +
    '</button>'
  )
}
const wordmark =
  '<div class="clubmark"><span class="clubpaw">' +
  paw +
  '</span><span>BEAST MODE<span class="clubsub">RACING CLUB</span></span></div>'
const coursePlate =
  '<aside class="course-plate"><span class="plate-num">' +
  icon('flag', 26) +
  '</span><div><small>FEATURED COURSE</small><strong>Jungle Breakdown</strong></div></aside>'
function menu() {
  return (
    '<header class="topbar">' +
    wordmark +
    '<div class="nav-tools"><button data-action="controls">' +
    icon('keys', 18) +
    '<span>Controls</span></button><button data-action="settings">' +
    icon('settings', 18) +
    '<span>Settings</span></button><i></i><button class="sound-toggle" data-action="mute" aria-label="Mute audio"></button></div></header>' +
    '<div class="menu-split"><section class="entry-panel"><div class="entry-inner"><div class="flag-label"><b class="check-flag"></b>NATURAL DISASTERS</div><h1>BEAST<span>MODE<span class="title-stop">.</span></span></h1>' +
    '<p class="tagline">Evolution was a mistake.<br><b>Now it’s a race.</b></p>' +
    '<div class="play-choices">' +
    action('create', 'Create room', 'flag', true) +
    action('join', 'Join room', 'users') +
    '<button class="practice-link" data-action="practice">' +
    icon('run', 17) +
    'Solo practice' +
    icon('arrow', 15) +
    '</button></div></div></section>' +
    '<div class="course-window"><i class="view-corner tl"></i><i class="view-corner tr"></i>' +
    coursePlate +
    '<i class="view-corner br"></i></div></div>' +
    '<footer class="menu-footer"><span>' +
    icon('users', 15) +
    ' 2–8 racers</span><b></b><span>' +
    icon('clock', 15) +
    ' 2–4 min races</span><b></b><span>' +
    icon('globe', 15) +
    ' Online multiplayer</span><i class="checks"></i></footer>'
  )
}
function smallHeader(right: string) {
  return (
    '<header class="topbar">' +
    wordmark +
    '<div class="nav-tools">' +
    right +
    '</div></header>'
  )
}
function bars(value: number) {
  return (
    '<span class="stat-bars" aria-label="' +
    value +
    ' out of five">' +
    [1, 2, 3, 4, 5]
      .map((i) => '<i class="' + (i <= value ? 'full' : '') + '"></i>')
      .join('') +
    '</span>'
  )
}
function driverDeck(animal: Animal) {
  const spec = ANIMALS[animal]
  return (
    '<div class="driver-grid" role="group" aria-label="Choose your animal">' +
    entries
      .map(
        ([id, d]) =>
          '<button data-action="animal" data-animal="' +
          id +
          '" aria-pressed="' +
          (animal === id) +
          '" style="--driver:' +
          d.color +
          '"><span class="portrait"><img alt="" src="' +
          animalPortrait(id) +
          '"></span><strong>' +
          d.name +
          '</strong></button>',
      )
      .join('') +
    '</div>' +
    '<div class="driver-details"><div class="driver-heading"><small>' +
    escape(spec.role) +
    '</small><strong>' +
    escape(spec.special) +
    '</strong></div><div class="ratings">' +
    ['speed', 'handling', 'chaos']
      .map(
        (key) =>
          '<div>' +
          key +
          bars(spec[key as 'speed' | 'handling' | 'chaos']) +
          '</div>',
      )
      .join('') +
    '</div>' +
    '<div class="trait"><b>Passive</b> ' +
    escape(spec.passive) +
    '</div><div class="trait"><b>Weakness</b> ' +
    escape(spec.weakness) +
    '</div></div>'
  )
}
function lobby(snapshot: Snapshot, me: Player) {
  const host = me.id === snapshot.hostId
  const guests = snapshot.players.filter((p) => p.id !== snapshot.hostId)
  const canStart =
    snapshot.practice || (guests.length > 0 && guests.every((p) => p.ready))
  return (
    smallHeader(
      '<button data-action="controls">' +
        icon('keys', 18) +
        'Controls</button><button data-action="settings" aria-label="Settings">' +
        icon('settings', 18) +
        '</button><button data-action="leave">Leave room</button>',
    ) +
    '<div class="lobby-layout"><section class="lobby-panel"><div class="lobby-code"><span class="micro">' +
    (snapshot.practice ? 'PRACTICE ROOM' : 'ROOM CODE') +
    '</span><button data-action="copy" title="Copy room code">' +
    escape(snapshot.code) +
    icon('copy', 17) +
    '</button></div><h1 class="section-title">Starting grid<span>.</span></h1><h2 class="subhead">Choose your racer</h2>' +
    driverDeck(me.animal) +
    '<h2 class="subhead roster-head">Room lineup <span>' +
    snapshot.players.length +
    ' / ' +
    (snapshot.practice ? '1' : '8') +
    '</span></h2><ul class="roster">' +
    snapshot.players
      .map(
        (p) =>
          '<li><i style="--driver:' +
          ANIMALS[p.animal].color +
          '"></i><span><b>' +
          escape(p.name) +
          '</b> <small>' +
          ANIMALS[p.animal].name +
          '</small></span><em>' +
          (p.id === snapshot.hostId
            ? 'Host'
            : p.ready
              ? 'Ready'
              : 'Getting ready') +
          '</em></li>',
      )
      .join('') +
    '</ul>' +
    '<div class="lobby-start">' +
    (host
      ? '<button class="action primary" data-action="start" ' +
        (canStart ? '' : 'disabled') +
        '>' +
        icon('flag') +
        '<span>Start race</span>' +
        icon('arrow') +
        '</button>' +
        (canStart
          ? ''
          : '<p>' +
            (guests.length
              ? 'Waiting for everyone to ready up.'
              : 'Share the room code to invite a racer.') +
            '</p>')
      : action(
          'ready',
          me.ready ? 'Cancel ready' : 'Ready to race',
          'check',
          !me.ready,
        )) +
    '</div></section><div class="lobby-window">' +
    coursePlate +
    '<span class="staging-hint">' +
    icon('keys', 16) +
    ' WASD to test your racer</span></div></div>'
  )
}
function race() {
  return (
    '<div class="race-ui"><div class="hud-top"><div class="position-tile"><small>POSITION</small><strong id="place"></strong></div><div class="course-hud"><b>Jungle Breakdown</b><span id="zone"></span></div><div class="race-clock">' +
    icon('clock', 18) +
    '<b id="timer"></b></div><button class="pause-btn" data-action="pause" aria-label="Race menu">' +
    icon('pause', 20) +
    '</button></div>' +
    '<div class="announcer" id="event" role="status"></div><div class="countdown" id="count" aria-live="polite"></div>' +
    '<div class="hud-bottom"><div class="race-progress"><div><small>CHECKPOINTS</small><b id="checks"></b></div><progress id="progress" max="1"></progress><span id="direction"></span></div><div class="ability-hud"><div class="ability-line"><kbd id="ability-key">E</kbd><strong id="ability"></strong><span id="cool"></span></div><div class="resist-line"><kbd>Q</kbd><b id="instinct">Instinct resistance</b><progress id="resist" max="1"></progress></div></div></div></div>'
  )
}
const awards = [
  ['collisions', 'Bumper beast', 'bumps'],
  ['airborne', 'Frequent flyer', 's airborne'],
  ['biggestFall', 'Cliff diver', 'm fallen'],
  ['abilities', 'Special delivery', 'specials'],
  ['throws', 'Hurl champion', 'throws'],
  ['backward', 'Wrong-way wonder', 'm reversed'],
] as const
function results(s: Snapshot, me: Player) {
  const sorted = [...s.players].sort((a, b) => a.place - b.place)
  const host = me.id === s.hostId
  return (
    '<div class="result-wrap"><section class="result-card"><div class="result-header"><i class="check-flag"></i><span>Jungle Breakdown</span><i class="check-flag"></i></div><h1 class="section-title">Race results<span>.</span></h1><p class="result-summary">' +
    (me.finishTime !== null
      ? 'You finished ' +
        ordinal(me.place) +
        ' in ' +
        time(me.finishTime, true) +
        '.'
      : 'The race has ended.') +
    '</p><ol class="scores">' +
    sorted
      .map(
        (p) =>
          '<li class="' +
          (p.id === me.id ? 'mine' : '') +
          '"><b>' +
          ordinal(p.place) +
          '</b><span><strong>' +
          escape(p.name) +
          '</strong><small>' +
          ANIMALS[p.animal].name +
          '</small></span><em>' +
          (p.finishTime === null ? 'DNF' : time(p.finishTime, true)) +
          '</em></li>',
      )
      .join('') +
    '</ol>' +
    '<h2 class="subhead">Race awards</h2><div class="award-grid">' +
    awards
      .map(([key, label, unit]) => {
        const champ = sorted.reduce((a, b) =>
          a.stats[key] >= b.stats[key] ? a : b,
        )
        const value = champ.stats[key]
        return (
          '<div><b>' +
          label +
          '</b><span>' +
          (value > 0
            ? escape(champ.name) +
              ' · ' +
              Math.round(value * 10) / 10 +
              ' ' +
              unit
            : '—') +
          '</span></div>'
        )
      })
      .join('') +
    '</div>' +
    '<div class="result-actions">' +
    (host
      ? action('rematch', 'Rematch', 'flag', true) +
        action('lobby', 'Return to lobby', 'users')
      : '<p>Waiting for the host to start a rematch.</p>') +
    '<button class="practice-link" data-action="leave">Exit to menu ' +
    icon('arrow', 16) +
    '</button></div></section></div>'
  )
}

export class GameUI {
  private readonly surface: HTMLElement
  private readonly dialog: HTMLDialogElement
  private readonly toast: HTMLElement
  private readonly values = readSettings()
  private screen: Screen = 'menu'
  private overlay: Overlay = ''
  private snapshot?: Snapshot
  private selfId = ''
  private signature = ''
  private nickname = load('beast-name') ?? ''
  private returnToPause = false
  private errorTimer = 0
  private lastTrigger: HTMLElement | null = null
  private nodes = new Map<string, HTMLElement>()

  constructor(
    private readonly root: HTMLElement,
    private readonly actions: UIActions,
  ) {
    root.innerHTML =
      '<div class="surface"></div><dialog class="overlay"></dialog><div class="toast" role="status" aria-live="polite"></div>'
    this.surface = root.querySelector('.surface')!
    this.dialog = root.querySelector('dialog')!
    this.toast = root.querySelector('.toast')!
    root.addEventListener('click', (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('button[data-action]')
          : null
      if (target && !target.disabled) this.act(target.dataset.action!, target)
      else if (event.target === this.dialog && this.dialog.open) {
        const { left, right, top, bottom } = this.dialog.getBoundingClientRect()
        if (
          event.clientX < left ||
          event.clientX > right ||
          event.clientY < top ||
          event.clientY > bottom
        )
          this.closeOverlay()
      }
    })
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault()
      this.closeOverlay()
    })
    this.dialog.addEventListener('submit', (event) => {
      event.preventDefault()
      if (!(event.target instanceof HTMLFormElement)) return
      const name =
        event.target.querySelector<HTMLInputElement>('[name=nickname]')!
      const nickname = name.value.trim()
      if (!nickname) {
        name.setCustomValidity('Enter your nickname.')
        name.reportValidity()
        return
      }
      this.nickname = nickname
      save('beast-name', nickname)
      const intent = this.overlay
      const code =
        event.target
          .querySelector<HTMLInputElement>('[name=code]')
          ?.value.trim()
          .toUpperCase() ?? ''
      this.closeOverlay()
      if (intent === 'create') this.actions.create(nickname)
      if (intent === 'join') this.actions.join(nickname, code)
      if (intent === 'practice') this.actions.practice(nickname)
    })
    this.dialog.addEventListener('input', (event) => {
      if (!(event.target instanceof HTMLInputElement)) return
      const field = event.target
      field.setCustomValidity('')
      if (field.name === 'code')
        field.value = field.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
      if (field.type === 'range') {
        const key = field.name as 'music' | 'sfx' | 'announcer' | 'distance'
        const num = Number(field.value)
        this.values[key] = key === 'distance' ? num : num / 100
        const output = field.parentElement?.querySelector('output')
        if (output)
          output.textContent = key === 'distance' ? num + ' m' : num + '%'
        this.commitSettings()
      }
    })
    this.showMenu()
    this.actions.settings({ ...this.values })
  }

  showMenu() {
    this.snapshot = undefined
    this.selfId = ''
    this.signature = ''
    this.setScreen('menu', menu())
    this.updateSound()
  }

  update(s: Snapshot, selfId: string) {
    const me = s.players.find((p) => p.id === selfId)
    if (!me) return
    this.snapshot = s
    this.selfId = selfId
    const next: Screen =
      s.phase === 'WAITING'
        ? 'lobby'
        : s.phase === 'RESULTS'
          ? 'results'
          : 'race'
    if (next === 'race') {
      if (this.screen !== next) this.setScreen(next, race())
      this.updateHud(s, me)
      return
    }
    // Race ranking changes as players move around the staging area. Keep the
    // lineup in a stable order so selecting a racer never steals keyboard focus.
    if (next === 'lobby') {
      const players = [...s.players].sort(
        (a, b) =>
          Number(b.id === s.hostId) - Number(a.id === s.hostId) ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      )
      s = { ...s, players }
    }
    const signature = JSON.stringify([
      next,
      s.code,
      s.hostId,
      s.practice,
      s.players.map((p) => [
        p.id,
        p.name,
        p.animal,
        p.ready,
        next === 'results' ? p.finishTime : null,
      ]),
    ])
    if (this.screen === next && signature === this.signature) return
    const focused =
      document.activeElement instanceof HTMLButtonElement
        ? document.activeElement
        : null
    const lobbyScroll =
      this.surface.querySelector('.lobby-panel')?.scrollTop ?? 0
    this.setScreen(next, next === 'lobby' ? lobby(s, me) : results(s, me))
    const panel = this.surface.querySelector('.lobby-panel')
    if (panel) panel.scrollTop = lobbyScroll
    if (focused?.dataset.action && !this.dialog.open) {
      const same = [
        ...this.surface.querySelectorAll<HTMLButtonElement>('button'),
      ].find(
        (b) =>
          b.dataset.action === focused.dataset.action &&
          b.dataset.animal === focused.dataset.animal,
      )
      same?.focus({ preventScroll: true })
    }
    this.signature = signature
  }

  isOverlayOpen() {
    return this.dialog.open
  }

  togglePause() {
    if (this.overlay) {
      this.closeOverlay()
      return
    }
    if (this.screen === 'race' || this.screen === 'lobby')
      this.openOverlay('pause')
  }

  error(message: string) {
    this.toast.textContent = message
    this.toast.classList.add('visible')
    window.clearTimeout(this.errorTimer)
    this.errorTimer = window.setTimeout(
      () => this.toast.classList.remove('visible'),
      4500,
    )
  }

  private setScreen(screen: Screen, html: string) {
    if (screen !== this.screen && this.overlay) this.closeOverlay(true)
    this.screen = screen
    document.body.dataset.screen = screen
    this.surface.innerHTML = html
    this.nodes.clear()
    this.surface
      .querySelectorAll<HTMLElement>('[id]')
      .forEach((el) => this.nodes.set(el.id, el))
  }

  private updateHud(s: Snapshot, me: Player) {
    const write = (id: string, value: string) => {
      const el = this.nodes.get(id)!
      if (el.textContent !== value) el.textContent = value
    }
    const meter = (id: string, num: number) => {
      ;(this.nodes.get(id) as HTMLProgressElement).value = Math.max(
        0,
        Math.min(1, num),
      )
    }
    const zone = zoneAt(me.z)
    write('place', ordinal(me.place) + ' / ' + s.players.length)
    write('zone', ZONES[zone].name)
    write('timer', time(s.elapsed, true))
    write('checks', Math.max(0, me.checkpoint) + ' / ' + CHECKPOINTS.length)
    meter('progress', me.z / FINISH_Z)
    const target = Math.max(me.z + 8, CHECKPOINTS[me.checkpoint] ?? FINISH_Z)
    const turn =
      Math.atan2(centerAt(me.z + 10) - me.x, Math.min(10, target - me.z)) -
      me.yaw
    const heading = Math.atan2(Math.sin(turn), Math.cos(turn))
    write(
      'direction',
      me.finishTime !== null
        ? 'Finish line crossed'
        : Math.abs(heading) > 1.8
          ? '↶  Turn around'
          : heading > 0.38
            ? '↖  Bear left'
            : heading < -0.38
              ? '↗  Bear right'
              : '↑  Straight ahead',
    )
    const grabbing = me.animal === 'gorilla'
    write('ability-key', grabbing && !me.active ? 'F' : 'E')
    write(
      'ability',
      grabbing && me.active ? 'Throw racer' : ANIMALS[me.animal].special,
    )
    write(
      'cool',
      me.active
        ? 'Active'
        : me.cooldown > 0.05
          ? Math.ceil(me.cooldown) + 's'
          : 'Ready',
    )
    write('instinct', me.instinct || 'Instinct resistance')
    meter('resist', me.resistance)
    write(
      'count',
      s.phase === 'COUNTDOWN'
        ? String(Math.max(1, Math.ceil(s.countdown)))
        : s.elapsed < 0.8
          ? 'GO!'
          : '',
    )
    const e = s.event
    write(
      'event',
      me.finishTime !== null
        ? 'Finished! Waiting for the field…'
        : e
          ? (e.stage === 'warning' ? 'Incoming · ' : '') +
            (e.kind === 'lowGravity'
              ? 'Gravity is taking a break!'
              : 'Forecast: falling bananas!') +
            ' · ' +
            Math.ceil(e.remaining) +
            's'
          : '',
    )
  }

  private act(name: string, button: HTMLButtonElement) {
    const me = this.snapshot?.players.find((p) => p.id === this.selfId)
    switch (name) {
      case 'create':
      case 'join':
        this.openOverlay(name)
        break
      case 'practice':
        if (this.nickname) this.actions.practice(this.nickname)
        else this.openOverlay(name)
        break
      case 'settings':
      case 'controls':
        this.returnToPause = this.overlay === 'pause'
        this.openOverlay(name)
        break
      case 'pause':
        this.togglePause()
        break
      case 'close':
        this.closeOverlay()
        break
      case 'mute':
        this.values.muted = !this.values.muted
        this.commitSettings()
        this.updateSound()
        break
      case 'copy':
        this.copyCode()
        break
      case 'animal':
        if (isAnimal(button.dataset.animal))
          this.actions.select(button.dataset.animal)
        break
      case 'ready':
        if (me) this.actions.ready(!me.ready)
        break
      case 'start':
        this.actions.start()
        break
      case 'leave':
        if (this.overlay) this.closeOverlay(true)
        this.actions.leave()
        break
      case 'lobby':
        if (this.overlay) this.closeOverlay(true)
        this.actions.lobby()
        break
      case 'rematch':
        this.actions.rematch()
        break
    }
  }

  private async copyCode() {
    const code = this.snapshot?.code
    if (!code) return
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(code)
      else {
        const text = document.createElement('textarea')
        text.value = code
        text.className = 'copy-helper'
        this.root.append(text)
        text.select()
        const copied = document.execCommand('copy')
        text.remove()
        if (!copied) throw new Error('clipboard')
      }
      this.error('Room code copied.')
    } catch {
      this.error('Room code: ' + code)
    }
  }

  private commitSettings() {
    save('beast-settings', JSON.stringify(this.values))
    this.actions.settings({ ...this.values })
  }

  private updateSound() {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      '[data-action=mute]',
    )) {
      button.setAttribute(
        'aria-label',
        this.values.muted ? 'Unmute audio' : 'Mute audio',
      )
      button.setAttribute('aria-pressed', String(this.values.muted))
      button.innerHTML =
        icon(this.values.muted ? 'mute' : 'volume', 18) +
        (button.classList.contains('mute-setting')
          ? ' <span>' +
            (this.values.muted ? 'Audio muted' : 'Audio on') +
            '</span>'
          : '')
    }
  }

  private openOverlay(overlay: Exclude<Overlay, ''>) {
    if (!this.dialog.open)
      this.lastTrigger =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    this.overlay = overlay
    let title = '',
      content = ''
    if (overlay === 'create' || overlay === 'join' || overlay === 'practice') {
      title =
        overlay === 'create'
          ? 'Create room'
          : overlay === 'join'
            ? 'Join room'
            : 'Solo practice'
      content =
        '<form><label class="field">Racer nickname<input name="nickname" placeholder="Your nickname" maxlength="18" autocomplete="nickname" value="' +
        escape(this.nickname) +
        '" required></label>' +
        (overlay === 'join'
          ? '<label class="field">Room code<input name="code" placeholder="ABCDE" maxlength="5" minlength="5" pattern="[A-Za-z0-9]{5}" autocomplete="off" autocapitalize="characters" required></label>'
          : '') +
        '<button type="submit" class="action primary">' +
        icon(overlay === 'practice' ? 'run' : 'flag') +
        '<span>' +
        (overlay === 'join'
          ? 'Join starting grid'
          : overlay === 'practice'
            ? 'Start practice'
            : 'Create room') +
        '</span>' +
        icon('arrow') +
        '</button></form>'
    } else if (overlay === 'controls') {
      title = 'Race controls'
      content =
        '<dl class="controls-list">' +
        controls
          .map(
            ([key, label]) =>
              '<div><dt><kbd>' +
              key +
              '</kbd></dt><dd>' +
              label +
              '</dd></div>',
          )
          .join('') +
        '</dl>'
    } else if (overlay === 'settings') {
      title = 'Settings'
      content =
        '<div class="settings-list">' +
        (
          [
            ['music', 'Music'],
            ['sfx', 'Sound effects'],
            ['announcer', 'Announcer'],
            ['distance', 'Camera distance'],
          ] as const
        )
          .map(([key, label]) => {
            const dist = key === 'distance'
            const val = dist
              ? this.values.distance
              : Math.round(this.values[key] * 100)
            return (
              '<label class="slider-field" for="setting-' +
              key +
              '">' +
              label +
              '<output aria-hidden="true">' +
              val +
              (dist ? ' m' : '%') +
              '</output><input type="range" id="setting-' +
              key +
              '" name="' +
              key +
              '" min="' +
              (dist ? 4 : 0) +
              '" max="' +
              (dist ? 12 : 100) +
              '" value="' +
              val +
              '"></label>'
            )
          })
          .join('') +
        '<button class="mute-setting" data-action="mute"></button></div>'
    } else {
      title = 'Race menu'
      content =
        '<div class="pause-actions">' +
        action('close', 'Resume', 'arrow', true) +
        action('controls', 'Controls', 'keys') +
        action('settings', 'Settings', 'settings') +
        (this.snapshot?.practice && this.screen === 'race'
          ? action('lobby', 'Change racer', 'users')
          : '') +
        '<button data-action="leave" class="practice-link">Leave room ' +
        icon('arrow', 15) +
        '</button></div>'
    }
    this.dialog.innerHTML =
      '<div class="dialog-bar"><b class="check-flag"></b><button aria-label="Close" data-action="close">' +
      icon('close') +
      '</button></div><h2 id="dialog-title">' +
      title +
      '<span>.</span></h2>' +
      content
    this.dialog.setAttribute('aria-labelledby', 'dialog-title')
    if (!this.dialog.open) this.dialog.showModal()
    this.actions.pause(true)
    this.updateSound()
    const first = this.dialog.querySelector<HTMLElement>(
      overlay === 'join' && this.nickname
        ? '[name=code]'
        : 'input, .action, .dialog-bar button',
    )
    if (overlay === 'create' || overlay === 'join' || overlay === 'practice') {
      this.dialog
        .querySelector<HTMLElement>(
          overlay === 'join' && this.nickname
            ? '[name=code]'
            : '[name=nickname]',
        )
        ?.focus()
    } else first?.focus()
  }

  private closeOverlay(force = false) {
    if (this.returnToPause && !force) {
      this.returnToPause = false
      this.openOverlay('pause')
      return
    }
    this.returnToPause = false
    this.overlay = ''
    this.dialog.close()
    this.actions.pause(false)
    if (this.lastTrigger?.isConnected)
      this.lastTrigger.focus({ preventScroll: true })
    this.lastTrigger = null
  }
}
