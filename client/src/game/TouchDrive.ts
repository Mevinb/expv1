import { idleInput, type Input, type Player } from '@beast/shared/protocol'
import './touch.css'

/** Pointer capture lets steering and an action button be held by separate thumbs. */
export class TouchDrive {
  private readonly root = document.createElement('div')
  private readonly pad: HTMLElement
  private readonly media = matchMedia('(any-pointer: coarse)')
  private readonly down = new Map<number, keyof Input>()
  private stick: number | null = null
  private x = 0
  private z = 0
  private active = false
  private cup = false
  private actions = idleInput()
  private taps = idleInput()

  constructor() {
    this.root.className = 'touch-drive'
    this.root.hidden = true
    this.root.setAttribute('aria-label', 'Driving controls')
    this.root.innerHTML = '<div class="drive-pad" aria-label="Steer"><span class="drive-stick"></span></div>' +
      '<div class="drive-buttons"><button data-key="interact">Grab</button><button data-key="resist">Resist</button>' +
      '<button data-key="jump">Jump</button><button data-key="ability">Special</button></div>'
    this.pad = this.root.querySelector('.drive-pad')!
    document.body.append(this.root)
    this.pad.addEventListener('pointerdown', e => {
      if (this.stick !== null) return
      e.preventDefault()
      this.stick = e.pointerId
      this.pad.setPointerCapture(e.pointerId)
      this.drag(e)
    })
    this.pad.addEventListener('pointermove', e => { if (this.stick === e.pointerId) this.drag(e) })
    this.root.addEventListener('pointerdown', e => {
      const button = (e.target as Element).closest<HTMLButtonElement>('button[data-key]')
      if (!button) return
      e.preventDefault()
      button.setPointerCapture(e.pointerId)
      const key = button.dataset.key as 'jump' | 'resist' | 'ability' | 'interact'
      this.actions[key] = this.taps[key] = true
      this.down.set(e.pointerId, key)
      button.classList.add('pressed')
    })
    const end = (e: PointerEvent) => {
      if (this.stick === e.pointerId) this.resetStick()
      const key = this.down.get(e.pointerId)
      if (!key) return
      this.down.delete(e.pointerId)
      if (![...this.down.values()].includes(key)) {
        Object.assign(this.actions, { [key]: false })
        this.root.querySelector('[data-key='+key+']')?.classList.remove('pressed')
      }
    }
    for (const type of ['pointerup','pointercancel','lostpointercapture'] as const) this.root.addEventListener(type, end)
  }

  private drag(e: PointerEvent) {
    const box = this.pad.getBoundingClientRect()
    const horizontal = (e.clientX - box.left - box.width / 2) / (box.width / 2.5)
    const vertical = (box.top + box.height / 2 - e.clientY) / (box.height / 2.5)
    const magnitude = Math.max(1, Math.hypot(horizontal, vertical))
    this.x = horizontal / magnitude
    this.z = vertical / magnitude
    this.pad.style.setProperty('--sx', this.x * 25 + 'px')
    this.pad.style.setProperty('--sy', -this.z * 25 + 'px')
  }

  private resetStick() {
    this.stick = null; this.x = this.z = 0
    this.pad.style.setProperty('--sx','0px'); this.pad.style.setProperty('--sy','0px')
  }

  show(player: Player | undefined, enabled: boolean, cup: boolean) {
    this.cup = cup
    const active = this.media.matches && enabled && !!player
    if (this.active !== active) {
      this.active = active; this.root.hidden = !active
      document.body.classList.toggle('touch-driving', active)
      if (!active) this.clear()
    }
    if (!active || !player) return
    this.root.querySelector<HTMLButtonElement>('[data-key=interact]')!.hidden = player.animal !== 'gorilla'
    this.root.querySelector<HTMLButtonElement>('[data-key=resist]')!.hidden = !player.instinct
    this.root.querySelector<HTMLButtonElement>('[data-key=ability]')!.textContent = player.animal === 'gorilla' ? 'Throw' : 'Special'
  }

  read() {
    const sampled = { ...this.actions, x: this.x, z: this.z, sprint: Math.hypot(this.x, this.z) > .7 }
    for (const key of ['jump','resist','ability','interact'] as const) sampled[key] ||= this.taps[key]
    this.taps = idleInput()
    return { input: sampled, brake: this.cup && this.z < -.4 }
  }

  clear() {
    this.down.clear(); this.resetStick(); this.actions = idleInput(); this.taps = idleInput()
    this.root.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'))
  }
  dispose() { this.root.remove(); document.body.classList.remove('touch-driving') }
}
