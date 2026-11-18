import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const origin = process.env.GAME_URL || 'http://localhost:5173'
const out = process.env.SCREENSHOT_DIR
if (out) await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
})
const pages = [], errors = []
async function capture(page, name) {
  if (out) await page.screenshot({ path: out + '/' + name + '.png', timeout: 45000 })
}
async function enter(page, kind, name, code) {
  await page.locator('[data-action=' + kind + ']').click()
  await page.locator('input[name=nickname]').fill(name)
  if (code) await page.locator('input[name=code]').fill(code)
  await page.locator('dialog button[type=submit]').click()
  await page.locator('body[data-screen=lobby]').waitFor()
}
try {
  for (let i = 0; i < 4; i++) {
    const page = await browser.newPage({ viewport: i === 0 ? { width: 1280, height: 800 } : { width: 800, height: 600 } })
    page.setDefaultTimeout(45000)
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto(origin)
    await page.locator('#scene canvas').waitFor()
    pages.push(page)
  }
  const [host, guest, third, fourth] = pages
  await host.bringToFront()
  assert.match(await host.title(), /Beast Mode/)
  await capture(host, 'menu')
  await host.locator('[data-action=settings]').click()
  const music = host.locator('input[name=music]')
  await music.fill('17')
  assert.equal(await host.evaluate(() => JSON.parse(localStorage.getItem('beast-settings')).music), .17)
  await host.locator('dialog [data-action=mute]').click()
  await host.keyboard.press('Escape')
  await host.locator('dialog').waitFor({ state: 'hidden' })
  await host.locator('[data-action=controls]').click()
  assert.match(await host.locator('dialog').innerText(), /Sprint/i)
  await host.keyboard.press('Escape')
  await enter(host, 'create', 'Fern')
  const code = (await host.locator('[data-action=copy]').innerText()).trim()
  assert.match(code, /^[A-Z2-9]{5}$/)
  for (const [i, peer] of [guest, third, fourth].entries()) {
    await peer.bringToFront()
    await enter(peer, 'join', ['Pip', 'Moss', 'Scout'][i], code)
    await peer.locator('[data-animal=' + ['penguin','gorilla','turtle'][i] + ']').click()
    await peer.locator('[data-action=ready]').click()
  }
  await host.bringToFront()
  assert.equal(await host.locator('.roster li').count(), 4)
  await capture(host, 'lobby')
  await host.locator('[data-action=start]').click()
  await Promise.all(pages.map(p => p.locator('body[data-screen=race]').waitFor()))
  await host.waitForFunction(() => !document.getElementById('count')?.textContent, {timeout: 20000})
  await host.keyboard.down('w'); await host.keyboard.down('Shift')
  await host.keyboard.down('Space'); await host.waitForTimeout(180); await host.keyboard.up('Space')
  await host.keyboard.down('e'); await host.waitForTimeout(220); await host.keyboard.up('e')
  await host.waitForFunction(() => document.getElementById('cool')?.textContent !== 'Ready')
  await host.waitForFunction(() => Number(document.getElementById('progress')?.value) > .001)
  await host.keyboard.up('w'); await host.keyboard.up('Shift')
  await capture(host, 'race')
  await host.keyboard.press('Escape')
  await host.locator('dialog').waitFor()
  await host.keyboard.press('Escape')
  await host.locator('dialog').waitFor({state:'hidden'})
  // A live disconnect with one racer remaining also ends the match cleanly.
  for (const peer of [guest, third, fourth]) await peer.close()
  await host.locator('body[data-screen=results]').waitFor()
  await capture(host, 'results')
  await host.locator('[data-action=lobby]').click()
  await host.locator('body[data-screen=lobby]').waitFor()
  await host.locator('[data-action=leave]').click()
  await host.locator('body[data-screen=menu]').waitFor()
  await host.setViewportSize({ width: 390, height: 844 })
  await capture(host, 'narrow-menu')
  assert.equal(await host.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(errors, [])
  console.log('Passed four-tab multiplayer, settings, movement, boost, disconnect results and return to lobby.')
} finally {
  await browser.close()
}
