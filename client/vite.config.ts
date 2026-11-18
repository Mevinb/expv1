import { defineConfig } from 'vite'
const backend = 'http://127.0.0.1:' + (process.env.PORT || '3001')
export default defineConfig(({ mode }) => ({
  base: mode === 'showcase' ? '/expv1/' : '/',
  worker: { format: 'es' },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy: { '/socket.io': { target: backend, ws: true }, '/health': backend } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } }
}))
