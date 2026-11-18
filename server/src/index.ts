import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'
import { attachGame } from './network.js'
import { initPhysics } from './Simulation.js'

await initPhysics()
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url))
const assets = existsSync(dist) ? sirv(dist, { single: true }) : undefined
const http = createServer((req, res) => {
  if (req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); return }
  if (assets) { assets(req, res); return }
  res.writeHead(404); res.end('Use the Vite client in development, or run npm run build.')
})
const game = attachGame(http)
const port = Number(process.env.PORT || 3001)
http.listen(port, process.env.HOST || '0.0.0.0', () => console.log('Beast Mode server listening on port ' + port))
process.once('SIGTERM', () => void game.close())
process.once('SIGINT', () => void game.close())
