import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'
import { WILDLINE_GATES } from '../shared/src/wildlines.ts'

const url = process.env.GAME_URL || 'http://localhost:5173'
const out = process.env.SCREENSHOT_DIR
if (out) await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.env.CHROME_PATH ? undefined : 'chrome',
  executablePath: process.env.CHROME_PATH, args: ['--enable-unsafe-swiftshader','--enable-webgl','--disable-dev-shm-usage'] })
const errors = []
try {
  const page = await browser.newPage({ viewport: {width: 1160, height: 745}, acceptDownloads: true })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  const socketRequests = []
  page.on('request', r => { if (r.url().includes('/socket.io')) socketRequests.push(r.url()) })
  // Observe the worker's real broadcasts without altering them. Drive through
  // normal keyboard events so every gate, time and placement is earned.
  await page.addInitScript(({ gates }) => {
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args)
        this.addEventListener('message', ({data}) => {
          if (data.type !== 'snapshot') return
          window.cupFrame = data.snapshot
          const me = data.snapshot.players.find(p => p.id === 'local')
          if (data.snapshot.phase !== 'RACING' || !window.autoDrive || !me) return
          const z = me.z + 4
          const center = 11 * Math.sin(z / 86) + 4 * Math.sin(z / 38)
          const gate = gates[me.wildline.lastGate + 1]
          const lane = z < 205 ? 8.7 : z < 438 ? -8.5 : z < 670 ? 0 : z < 921 ? -10.3 : 8.7
          const target = gate && gate.index < 3 ? gate.x : center + lane
          const delta = me.x - target + me.vx * .20
          const steer = delta > .7 ? 'KeyD' : delta < -.7 ? 'KeyA' : ''
          if (window.steering !== steer) {
            if (window.steering) dispatchEvent(new KeyboardEvent('keyup', { code:window.steering, bubbles:true }))
            if (steer) dispatchEvent(new KeyboardEvent('keydown', { code:steer, bubbles:true, cancelable:true }))
            window.steering = steer
          }
          if (me.wildline.burst > 0) window.earnedBurst = true
        })
      }
    }
  }, { gates: WILDLINE_GATES })
  await page.goto(url)
  await page.locator('#scene canvas').waitFor()
  if (out) await page.screenshot({path:out+'/cup-menu.png'})
  await page.locator('[data-action=cup-animal][data-animal=penguin]').click()
  await page.evaluate(() => { window.autoDrive = true })
  await page.locator('[data-action=cup]').click()
  await page.waitForFunction(() => window.cupFrame?.phase === 'RACING')
  assert.equal(await page.locator('#rivals li').count(), 4)
  await page.waitForFunction(() => window.cupFrame.elapsed > 1)
  await page.keyboard.press('Escape')
  await page.locator('dialog[open]').waitFor()
  await page.waitForTimeout(160)
  const paused = await page.locator('#timer').textContent()
  await page.waitForTimeout(350)
  assert.equal(await page.locator('#timer').textContent(), paused)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.cupFrame.elapsed > 3, undefined, { timeout:15000 })
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(180)
  const unfocused = await page.evaluate(() => window.cupFrame.elapsed)
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => window.cupFrame.elapsed), unfocused)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  if (out) await page.screenshot({path:out+'/cup-grid.png'})
  await page.waitForFunction(() => window.earnedBurst === true, undefined, {timeout:24000})
  if (out) await page.screenshot({path:out+'/cup-burst.png'})
  console.log('Earned the three-gate burst and observed four live racers.')
  await page.locator('body[data-screen=results]').waitFor({timeout:247000})
  const result = await page.evaluate(() => window.cupFrame.players.find(p=>p.id==='local'))
  assert.ok(result.finishTime !== null, JSON.stringify(result))
  const record = await page.evaluate(() => Number(localStorage.getItem('wildline.cup.best.penguin')))
  assert.equal(record,result.finishTime)
  if (out) await page.screenshot({path:out+'/cup-podium.png'})
  const download = page.waitForEvent('download', {timeout:10000})
  await page.locator('[data-action=photo]').click()
  const image = await download
  assert.match(image.suggestedFilename(), /penguin.*\.png$/)
  if (out) await image.saveAs(out+'/race-postcard.png')
  const bytes = await readFile(await image.path())
  assert.equal(bytes.readUInt32BE(16),1200)
  assert.ok(bytes.length > 25000)
  await page.locator('[data-action=rematch]').click()
  await page.waitForFunction(() => window.cupFrame?.phase === 'COUNTDOWN')
  assert.deepEqual(socketRequests,[])
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({ finish:result.finishTime, place:result.place, gates:result.wildline.hits, bestChain:result.wildline.best, postcardBytes:bytes.length }))
} finally { await browser.close() }
