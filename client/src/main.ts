import { io, type Socket } from 'socket.io-client'
import { idleInput, type ClientEvents, type Reply, type ServerEvents, type Snapshot } from '@beast/shared/protocol'
import { GameScene } from './game/GameScene'
import { GameAudio } from './game/Audio'
import { GameUI } from './ui/GameUI'

const socket: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false })
const audio = new GameAudio()
let scene: GameScene | undefined
let current: Snapshot | undefined
let paused = false
let cameraDistance = 8
const held = new Set<string>()
const pressed = new Set<string>()
const controls = ['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyF','KeyQ']

function movement() {
  if (!socket.connected || !current) return
  const input = idleInput()
  if (!paused && (current.phase === 'WAITING' || current.phase === 'RACING')) {
    const key = (...codes: string[]) => codes.some(code => held.has(code) || pressed.has(code))
    input.x = Number(key('KeyD','ArrowRight')) - Number(key('KeyA','ArrowLeft'))
    input.z = Number(key('KeyW','ArrowUp')) - Number(key('KeyS','ArrowDown'))
    input.yaw = scene?.yaw ?? 0
    input.jump = key('Space'); input.sprint = key('ShiftLeft','ShiftRight')
    input.ability = key('KeyE'); input.interact = key('KeyF'); input.resist = key('KeyQ')
  }
  pressed.clear()
  socket.volatile.emit('input', input)
}

function clearKeys() { held.clear(); pressed.clear(); movement() }
function toMenu() {
  current = undefined
  held.clear(); pressed.clear()
  paused = false
  scene?.setPaused(false); scene?.setMenu(); audio.menu(); ui.showMenu()
}

let pending = false
function request(send: (reply: Reply) => void) {
  audio.unlock()
  if (pending) return
  if (!scene) { ui.error('3D graphics are unavailable. Enable WebGL 2 and reload the page.'); return }
  if (!socket.connected) { socket.connect(); ui.error('Connecting to the race server. Please try again in a moment.'); return }
  pending = true
  const timeout = window.setTimeout(() => { pending = false; ui.error('The race server did not answer. Try again.') }, 5000)
  send(response => {
    clearTimeout(timeout); pending = false
    if (!response.ok) ui.error(response.error || 'Room action failed.')
  })
}

const ui = new GameUI(document.querySelector<HTMLElement>('#ui')!, {
  create: name => request(cb => socket.emit('create', { name }, cb)),
  join: (name, code) => request(cb => socket.emit('join', { name, code }, cb)),
  practice: name => request(cb => socket.emit('create', { name, practice: true }, cb)),
  select: animal => request(cb => socket.emit('select', animal, cb)),
  ready: ready => request(cb => socket.emit('ready', ready, cb)),
  start: () => request(cb => socket.emit('start', cb)),
  rematch: () => request(cb => socket.emit('rematch', cb)),
  lobby: () => request(cb => socket.emit('lobby', cb)),
  leave: () => request(cb => socket.emit('leave', result => { cb(result); if (result.ok) toMenu() })),
  settings: settings => { audio.configure(settings); cameraDistance = settings.distance; scene?.setDistance(cameraDistance) },
  pause: value => { paused = value; clearKeys(); scene?.setPaused(value) }
})

try {
  scene = new GameScene(document.querySelector<HTMLElement>('#scene')!)
  scene.setDistance(cameraDistance); scene.setMenu()
} catch (error) {
  console.error('Game graphics failed to initialize.', error)
  ui.error('WebGL 2 is required. Enable hardware acceleration in your browser and reload.')
}
socket.on('snapshot', frame => {
  if (!socket.id) return
  current = frame
  ui.update(frame, socket.id); scene?.setSnapshot(frame, socket.id); audio.snapshot(frame, socket.id)
})
socket.on('disconnect', () => {
  if (current) { toMenu(); ui.error('Connection lost. Rejoin your room when the server reconnects.') }
})
socket.connect()
window.addEventListener('pointerdown', () => audio.unlock(), { once: true })
window.addEventListener('keydown', event => {
  const target = event.target
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) ui.togglePause(); return }
  if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
  if (!current || paused || ui.isOverlayOpen() || !controls.includes(event.code)) return
  if (event.code === 'Space' && target instanceof HTMLButtonElement && current.phase === 'WAITING') return
  event.preventDefault()
  if (!held.has(event.code)) pressed.add(event.code)
  held.add(event.code)
})
window.addEventListener('keyup', event => held.delete(event.code))
window.addEventListener('blur', clearKeys)
document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys() })
const heartbeat = window.setInterval(movement, 1000 / 30)
if (import.meta.hot) import.meta.hot.dispose(() => { clearInterval(heartbeat); socket.disconnect(); scene?.dispose(); audio.dispose() })
