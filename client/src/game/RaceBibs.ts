import * as T from 'three'
import type { Animal } from '../../../shared/src/protocol.js'

type Uniform = {
  number: string
  accent: string
  center: [number, number, number]
  radius: [number, number, number]
  latitude: [number, number]
  panels: number[]
}

const uniforms: Record<Animal, Uniform> = {
  elephant: {
    number: '07',
    accent: '#ef754b',
    center: [0, 1.05, -0.09],
    radius: [0.875, 0.85, 1.04],
    latitude: [-0.03, 0.65],
    panels: [Math.PI, 1.66, -1.66],
  },
  penguin: {
    number: '19',
    accent: '#36b3b3',
    center: [0, 0.91, -0.01],
    radius: [0.57, 0.82, 0.6],
    latitude: [-0.25, 0.46],
    panels: [0, Math.PI],
  },
  gorilla: {
    number: '04',
    accent: '#e79338',
    center: [0, 1.03, -0.075],
    radius: [0.89, 0.89, 0.76],
    latitude: [-0.25, 0.45],
    panels: [0, Math.PI],
  },
  turtle: {
    number: '33',
    accent: '#a2bf50',
    center: [0, 0.72, -0.065],
    radius: [0.8, 0.63, 0.956],
    latitude: [0.08, 0.65],
    panels: [Math.PI, 1.28, -1.28],
  },
}

/** Curved cloth panels with upright numbers when seen from either side of the racer. */
export function raceBibs(animal: Animal) {
  const kit = uniforms[animal]
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 112
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#182a36'
  ctx.fillRect(0, 0, 160, 112)
  ctx.fillStyle = kit.accent
  ctx.fillRect(4, 4, 152, 104)
  ctx.fillStyle = '#f7eacb'
  ctx.fillRect(9, 19, 142, 83)
  ctx.fillStyle = '#18303c'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('W I L D L I N E', 80, 15)
  ctx.font = 'italic 900 87px sans-serif'
  ctx.fillText(kit.number, 76, 93)
  for (const x of [12, 147]) {
    ctx.fillStyle = '#bca984'
    ctx.beginPath()
    ctx.arc(x, 24, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  const map = new T.CanvasTexture(canvas)
  map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = []
  const columns = 7,
    rows = 4
  for (const middle of kit.panels) {
    const start = positions.length / 3
    for (let row = 0; row <= rows; row++) {
      const v = row / rows
      const latitude = T.MathUtils.lerp(...kit.latitude, v)
      for (let col = 0; col <= columns; col++) {
        const u = col / columns
        const angle = middle + (u - 0.5) * (animal === 'turtle' ? 1.34 : 1.11)
        positions.push(
          kit.center[0] + kit.radius[0] * Math.sin(angle) * Math.cos(latitude),
          kit.center[1] + kit.radius[1] * Math.sin(latitude),
          kit.center[2] + kit.radius[2] * Math.cos(angle) * Math.cos(latitude),
        )
        uv.push(u, v)
        if (col < columns && row < rows) {
          const j = start + row * (columns + 1) + col
          indices.push(
            j,
            j + 1,
            j + columns + 1,
            j + 1,
            j + columns + 2,
            j + columns + 1,
          )
        }
      }
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return new T.Mesh(g, new T.MeshLambertMaterial({ map }))
}
