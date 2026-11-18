import { ANIMALS } from '@beast/shared/animals'
import type { Player, Snapshot } from '@beast/shared/protocol'
import { ZONES, zoneAt } from '@beast/shared/track'

type Capture = (draw: (canvas: HTMLCanvasElement) => void) => void
const time = (seconds: number) => Math.floor(seconds / 60) + ':' + (seconds % 60).toFixed(2).padStart(5, '0')

/** Keep one uncompressed frame in memory. Encode only when the player saves their print. */
export class RacePhoto {
  private readonly film = document.createElement('canvas')
  private priority = -1
  private caption = ''
  private location = ''
  private captureTime = 0
  private previous?: Player
  private generation = 0

  reset() {
    this.priority = -1; this.caption = ''; this.previous = undefined; this.generation++
  }

  watch(frame: Snapshot, racer: Player, capture: Capture) {
    if (frame.phase === 'COUNTDOWN') { if (this.previous) this.reset(); return }
    if (!frame.cup || frame.phase !== 'RACING' || racer.finishTime !== null || frame.elapsed < 1) return
    const last = this.previous
    this.previous = racer
    let score = 0, caption = 'Off the grid'
    if (last && racer.place < last.place) { score = 2; caption = 'Making a pass' }
    if (last && racer.stats.abilities > last.stats.abilities) { score = 3; caption = ANIMALS[racer.animal].special }
    if (last && racer.wildline.hits > last.wildline.hits) { score = 4; caption = 'Through the gold' }
    if (last && last.wildline.burst <= 0 && racer.wildline.burst > 0) { score = 6; caption = 'Wildline burst' }
    if (last && racer.stats.throws > last.stats.throws) { score = 7; caption = 'Air delivery' }
    if (last && racer.stats.vents > last.stats.vents) { score = 8; caption = 'Geyser rider' }
    if (score <= this.priority) return
    const generation = this.generation
    capture(source => {
      if (generation !== this.generation || !source.width || !source.height) return
      this.film.width = 1080
      this.film.height = Math.round(1080 * Math.min(1.15, source.height / source.width))
      const ctx = this.film.getContext('2d')
      if (!ctx) return
      const h = source.width * this.film.height / this.film.width
      ctx.drawImage(source, 0, (source.height - h) / 2, source.width, h, 0, 0, this.film.width, this.film.height)
      this.priority = score; this.caption = caption
      this.location = ZONES[zoneAt(racer.z)].name; this.captureTime = frame.elapsed
    })
  }

  async save(racer: Player) {
    if (this.priority < 0) throw new Error('A race photo needs a visible lap on the course.')
    const print = document.createElement('canvas')
    print.width = 1200
    print.height = this.film.height + 324
    const ctx = print.getContext('2d')!
    ctx.fillStyle = '#102922'; ctx.fillRect(0, 0, print.width, print.height)
    ctx.fillStyle = '#ffd057'
    ctx.font = '900 42px "Archivo Black", system-ui'; ctx.fillText('WILDLINE CUP', 60, 72)
    ctx.fillStyle = '#e9eddd'; ctx.textAlign = 'right'; ctx.font = 'bold 22px system-ui'
    ctx.fillText(this.location.toUpperCase() + '  /  ' + time(this.captureTime), 1140, 68)
    ctx.textAlign = 'left'
    ctx.drawImage(this.film, 60, 105)
    const baseline = 105 + this.film.height
    ctx.fillStyle = '#ff895f'; ctx.fillRect(60, baseline, 1080, 8)
    ctx.fillStyle = '#faf3d9'; ctx.font = '900 60px "Archivo Black", system-ui'
    ctx.fillText(this.caption.toUpperCase(), 60, baseline + 85, 1050)
    ctx.font = 'bold 26px system-ui'; ctx.fillText(racer.name + '  /  ' + ANIMALS[racer.animal].name, 60, baseline + 140)
    const clock = racer.finishTime === null ? 'DNF' : time(racer.finishTime)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffd057'
    ctx.fillText('#' + racer.place + '   ·   ' + clock + '   ·   ' + racer.wildline.hits + ' gates', 1140, baseline + 140)
    const blob = await new Promise<Blob | null>(resolve => print.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Your browser could not save this photo.')
    const url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = 'wildline-cup-' + racer.animal + '.png'
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}
