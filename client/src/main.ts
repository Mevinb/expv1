import { io, type Socket } from 'socket.io-client'
import { idleInput, type Animal, type ClientEvents, type Reply, type ServerEvents, type Snapshot } from '@beast/shared/protocol'
import { GameScene } from './game/GameScene'
import { RacePhoto } from './game/RacePhoto'
import { GameAudio } from './game/Audio'
import { TouchDrive } from './game/TouchDrive'
import { GameUI } from './ui/GameUI'
import { LOCAL_ID, type LocalCommand, type LocalUpdate } from './local/messages'

const onlineRooms = import.meta.env.MODE !== 'showcase'
const socket: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false })
const audio = new GameAudio()
const touch = new TouchDrive()
const photo = new RacePhoto()
const held = new Set<string>(), pressed = new Set<string>()
const controls = new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyF','KeyQ'])
let scene: GameScene | undefined
let current: Snapshot | undefined
let paused = false
let cameraDistance = 8
let worker: Worker | undefined
let loadingTimer: ReturnType<typeof setTimeout> | undefined
let pending = false

function post(command: LocalCommand) { worker?.postMessage(command) }
function movement(neutral = false) {
  if (!current || (!worker && !socket.connected)) return
  const input = idleInput()
  if (!neutral && !paused && !document.hidden && (current.phase === 'WAITING' || current.phase === 'RACING')) {
    const { input: pad, brake } = touch.read()
    const key = (...codes: string[]) => codes.some(code => held.has(code) || pressed.has(code))
    const forward = key('KeyW','ArrowUp'), backward = key('KeyS','ArrowDown')
    input.x = Math.max(-1, Math.min(1, pad.x + Number(key('KeyD','ArrowRight')) - Number(key('KeyA','ArrowLeft'))))
    const cruise = !!current.cup && current.phase === 'RACING'
    input.z = cruise ? Number(!brake && !backward) : Math.max(-1, Math.min(1, pad.z + Number(forward) - Number(backward)))
    input.yaw = scene?.yaw ?? 0
    input.jump = key('Space') || pad.jump
    input.sprint = cruise || key('ShiftLeft','ShiftRight') || pad.sprint
    input.ability = key('KeyE') || pad.ability
    input.interact = key('KeyF') || pad.interact
    input.resist = key('KeyQ') || pad.resist
  }
  pressed.clear()
  if (worker) post({ type: 'input', input })
  else socket.volatile.emit('input', input)
}
function clearKeys() { held.clear(); pressed.clear(); touch.clear(); movement(true) }
function applyPause() {
  const stopped = paused || document.hidden
  clearKeys(); scene?.setPaused(stopped)
  post({ type: 'pause', paused: stopped })
  updateTouch()
}
function updateTouch() {
  const id = worker ? LOCAL_ID : socket.id
  const me = current?.players.find(p => p.id === id)
  touch.show(me, !paused && !document.hidden && (current?.phase === 'RACING' || current?.phase === 'WAITING'), !!current?.cup)
}
function toMenu() {
  worker?.terminate(); worker = undefined
  clearTimeout(loadingTimer); ui.loadingCup(false)
  current = undefined; paused = false; photo.reset()
  clearKeys(); updateTouch()
  scene?.setPaused(false); scene?.setMenu(); audio.menu(); ui.showMenu()
}
function receive(frame: Snapshot, self: string) {
  current = frame
  ui.update(frame, self); scene?.setSnapshot(frame, self); audio.snapshot(frame, self)
  const me = frame.players.find(p => p.id === self)
  if (frame.cup && scene && me) photo.watch(frame, me, draw => scene!.captureOnNextFrame(draw))
  updateTouch()
}
function playable() {
  audio.unlock()
  if (scene) return true
  ui.error('3D graphics are unavailable. Enable WebGL 2 and reload the page.')
  return false
}
function localRace(name: string, animal: Animal, cup: boolean) {
  if (!playable() || pending || worker) return
  ui.loadingCup(true)
  const fail = (message: string) => { toMenu(); ui.error(message) }
  try {
    const activeWorker = new Worker(new URL('./local/race.worker.ts', import.meta.url), { type: 'module', name: 'wildline-race' })
    worker = activeWorker
    activeWorker.onmessage = ({ data }: MessageEvent<LocalUpdate>) => {
      if (worker !== activeWorker) return
      if (data.type === 'error') {
        if (data.fatal) fail(data.message)
        else ui.error(data.message)
        return
      }
      if (!current) { clearTimeout(loadingTimer); ui.loadingCup(false) }
      receive(data.snapshot, LOCAL_ID)
    }
    activeWorker.onerror = () => {
      if (worker === activeWorker) fail('The local race could not load. Refresh and try again.')
    }
    loadingTimer = setTimeout(() => fail('The race engine took too long to load. Check your connection and try again.'), 45000)
    post({ type: 'launch', name: name.trim() || 'Rookie', animal, cup })
  } catch { fail('This browser could not start a race worker.') }
}

function request(send: (reply: Reply) => void) {
  if (!playable() || pending || worker || !onlineRooms) return
  pending = true
  const finish: Reply = result => {
    clearTimeout(timeout); socket.off('connect', transmit); socket.off('connect_error', failed)
    pending = false
    if (!result.ok) ui.error(result.error || 'Room action failed.')
  }
  const transmit = () => send(finish)
  const failed = () => finish({ ok: false, error: 'Could not reach the multiplayer server. The Wildline Cup is available here.' })
  const timeout = window.setTimeout(failed, 8000)
  if (socket.connected) transmit()
  else { socket.once('connect', transmit); socket.once('connect_error', failed); socket.connect() }
}

const ui = new GameUI(document.querySelector<HTMLElement>('#ui')!, {
  create: name => request(cb => socket.emit('create', { name }, cb)),
  join: (name, code) => request(cb => socket.emit('join', { name, code }, cb)),
  cup: (name, animal) => localRace(name, animal, true),
  photo: () => {
    const me = current?.players.find(p => p.id === LOCAL_ID)
    if (me) void photo.save(me).catch(err => ui.error(err.message))
  },
  practice: name => localRace(name, 'elephant', false),
  select: animal => worker ? post({ type: 'select', animal }) : request(cb => socket.emit('select', animal, cb)),
  ready: ready => request(cb => socket.emit('ready', ready, cb)),
  start: () => worker ? post({ type: 'start' }) : request(cb => socket.emit('start', cb)),
  rematch: () => worker ? post({ type: 'rematch' }) : request(cb => socket.emit('rematch', cb)),
  lobby: () => worker ? post({ type: 'lobby' }) : request(cb => socket.emit('lobby', cb)),
  leave: () => worker ? toMenu() : request(cb => socket.emit('leave', result => { cb(result); if (result.ok) toMenu() })),
  settings: settings => { audio.configure(settings); cameraDistance = settings.distance; scene?.setDistance(cameraDistance) },
  pause: value => { paused = value; applyPause() }
}, onlineRooms)

try {
  scene = new GameScene(document.querySelector<HTMLElement>('#scene')!)
  scene.setDistance(cameraDistance); scene.setMenu()
} catch (error) {
  console.error('Game graphics failed to initialize.', error)
  ui.error('WebGL 2 is required. Enable hardware acceleration in your browser and reload.')
}
socket.on('snapshot', frame => { if (!worker && socket.id) receive(frame, socket.id) })
socket.on('disconnect', () => {
  if (!current || worker) return
  const canRejoin = current.phase === 'WAITING'
  toMenu()
  ui.error(canRejoin ? 'Connection lost. Rejoin with the room code if the lobby is still open.'
    : 'Connection lost. Create a new room or rejoin when your friends return to the lobby.')
})
window.addEventListener('pointerdown', () => audio.unlock(), { once: true })
window.addEventListener('keydown', event => {
  const target = event.target
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) ui.togglePause(); return }
  if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
  if (!current || paused || ui.isOverlayOpen() || !controls.has(event.code)) return
  if (event.code === 'Space' && target instanceof HTMLButtonElement && current.phase === 'WAITING') return
  event.preventDefault()
  if (!held.has(event.code)) pressed.add(event.code)
  held.add(event.code)
})
window.addEventListener('keyup', event => held.delete(event.code))
window.addEventListener('blur', clearKeys)
document.addEventListener('visibilitychange', applyPause)
const heartbeat = window.setInterval(movement, 1000 / 30)
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearTimeout(loadingTimer); clearInterval(heartbeat); worker?.terminate()
  socket.disconnect(); scene?.dispose(); touch.dispose(); audio.dispose()
})
