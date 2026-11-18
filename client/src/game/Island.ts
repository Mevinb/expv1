import * as T from 'three'
import { ball, box, cone, pebble, Sculpt, seeded, tube } from './Art.js'
import {
  centerAt,
  elevationAt,
  halfWidthAt,
} from '../../../shared/src/track.js'

const navy = '#15394b',
  mango = '#ff7c32',
  mint = '#3bb9af',
  ivory = '#fff0c1',
  gold = '#ffc746'
type V = [number, number, number]
const stone = new T.CylinderGeometry(0.86, 1, 1, 7, 1)
const slab = new T.CylinderGeometry(1, 0.84, 1, 6, 1)
const pennant = new T.BufferGeometry()
pennant.setAttribute(
  'position',
  new T.Float32BufferAttribute(
    [
      -0.55, 0, 0, 0.55, 0, 0, 0.07, -1, 0.15, 0.07, -1, 0.15, 0.55, 0, 0,
      -0.55, 0, 0,
    ],
    3,
  ),
)
pennant.computeVertexNormals()

/** One coloured mesh per static landmark; moving water and cheering fans share batches. */
export function bunting(
  s: Sculpt,
  a: V,
  b: V,
  count: number,
  drop: number,
  size: number,
) {
  const point = (t: number): V => [
    T.MathUtils.lerp(a[0], b[0], t),
    T.MathUtils.lerp(a[1], b[1], t) - drop * Math.sin(Math.PI * t),
    T.MathUtils.lerp(a[2], b[2], t),
  ]
  const yaw = -Math.atan2(b[2] - a[2], b[0] - a[0])
  for (let i = 0; i < 5; i++)
    s.rod(point(i / 5), point((i + 1) / 5), 0.047 * size, navy)
  for (let i = 1; i <= count; i++) {
    const p = point(i / (count + 1))
    s.part(
      pennant,
      [mango, gold, mint, ivory][i % 4],
      p,
      [size, size * 1.28, size],
      [0, yaw, 0],
    )
  }
}

function erodedCone() {
  const rand = seeded(812)
  const n = 16,
    bands = [
      { y: -1, r: 1.18, dx: 0.02, dy: 0.015 },
      { y: 0.06, r: 0.76, dx: -0.06, dy: 0.05 },
      { y: 0.28, r: 0.53, dx: 0.01, dy: 0.065 },
      { y: 0.57, r: 0.32, dx: -0.025, dy: 0.055 },
      { y: 0.98, r: 0.16, dx: 0, dy: 0.025 },
      { y: 0.92, r: 0.1, dx: 0, dy: 0.008 },
    ]
  const positions: number[] = [],
    colors: number[] = []
  const ridges = Array.from({ length: n }, () => 0.82 + rand() * 0.33)
  const rings = bands.map((b) =>
    Array.from({ length: n }, (_, i): V => {
      const angle = (i * Math.PI * 2) / n
      return [
        b.dx + Math.sin(angle) * b.r * ridges[i],
        b.y + rand() * b.dy,
        Math.cos(angle) * b.r * ridges[i],
      ]
    }),
  )
  const colorsByHeight = [
    ['#276f70', '#377c74', '#438476', '#407772'],
    ['#4a8178', '#638b78', '#387877', '#649179'],
    ['#786b76', '#7b7884', '#616f78', '#9b8176'],
    ['#6f5967', '#80616b', '#a56e69', '#986860'],
    ['#d86448', '#fe934b', '#af544e', '#ec7850'],
  ]
  const col = new T.Color()
  function triangle(a: V, b: V, c: V, color: string) {
    positions.push(...a, ...b, ...c)
    col.set(color)
    for (let i = 0; i < 3; i++) colors.push(col.r, col.g, col.b)
  }
  for (let row = 0; row < bands.length - 1; row++) {
    const palette = colorsByHeight[row]
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n,
        a = rings[row][j],
        b = rings[row][k],
        c = rings[row + 1][j],
        d = rings[row + 1][k]
      triangle(a, b, c, palette[(j + row) % 4])
      triangle(b, d, c, palette[(j + 1 + row) % 4])
      if ((j === 8 || j === 12 || j === 5 || j === 0) && row > 0 && row < 4) {
        const m = (point: V, toward: V, t: number): V => [
          (point[0] + (toward[0] - point[0]) * t) * 1.012,
          point[1] + (toward[1] - point[1]) * t + 0.004,
          (point[2] + (toward[2] - point[2]) * t) * 1.012,
        ]
        const lo = m(a, b, 0.24),
          hi = m(c, d, 0.22),
          lo2 = m(a, b, 0.32),
          hi2 = m(c, d, 0.42)
        triangle(lo, lo2, hi, '#ff8850')
        triangle(lo2, hi2, hi, '#ffad54')
      }
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

const mountainShape = erodedCone()
const islandPaint = new T.MeshBasicMaterial({
  vertexColors: true,
  side: T.DoubleSide,
  fog: false,
})
const haze = new T.MeshBasicMaterial({ color: '#ffffff', fog: false })
const mat = new T.Object3D()
export function caldera() {
  const group = new T.Group()
  const mountain = new T.Mesh(mountainShape, islandPaint)
  mountain.scale.set(55, 30, 43)
  group.add(mountain)
  const smoke = new T.InstancedMesh(pebble, haze, 16)
  smoke.frustumCulled = false
  smoke.instanceMatrix.setUsage(T.DynamicDrawUsage)
  const color = new T.Color()
  for (let i = 0; i < 16; i++)
    smoke.setColorAt(
      i,
      color.set(['#ed9b7e', '#e8a48c', '#ecc1a8', '#f4cfb3'][i % 4]),
    )
  const ejecta = new T.InstancedMesh(pebble, haze, 20)
  ejecta.frustumCulled = false
  ejecta.instanceMatrix.setUsage(T.DynamicDrawUsage)
  for (let i = 0; i < 20; i++)
    ejecta.setColorAt(i, color.set(i % 3 ? '#ff8b43' : '#ffe187'))
  group.add(smoke, ejecta)
  return {
    group,
    update(t: number, eruption = 0) {
      ejecta.visible = eruption > 0.02
      if (ejecta.visible) {
        for (let i = 0; i < 20; i++) {
          const age = (t * 0.78 + i / 20) % 1,
            a = i * 2.4,
            r = age * (7 + (i % 7)) * eruption
          mat.position.set(
            Math.cos(a) * r,
            30 + Math.sin(Math.PI * age) * (4 + (i % 7)) * eruption,
            Math.sin(a) * r,
          )
          mat.rotation.set(a, age * 5, 0)
          mat.scale.setScalar(
            (0.23 + (i % 4) * 0.23) * Math.sin(age * Math.PI) * eruption,
          )
          mat.updateMatrix()
          ejecta.setMatrixAt(i, mat.matrix)
        }
        ejecta.instanceMatrix.needsUpdate = true
      }
      for (let i = 0; i < 16; i++) {
        const age = (t * 0.115 + i / 16) % 1,
          side = Math.sin(i * 61.7)
        const radius =
          (1.5 + 2.4 * age) * (1 + eruption * 0.75) * Math.min(1, (1 - age) * 8)
        mat.position.set(
          age * 14 + side * (0.9 + age * 2.1),
          29 + age * (16 + eruption * 8),
          1 + Math.cos(i) * 1.8,
        )
        mat.scale.set(radius * 1.25, radius, radius)
        mat.rotation.set(0, i + t * 0.09, 0)
        mat.updateMatrix()
        smoke.setMatrixAt(i, mat.matrix)
      }
      smoke.instanceMatrix.needsUpdate = true
    },
  }
}

function fan(bird: boolean) {
  const s = new Sculpt()
  s.part(pebble, bird ? '#338ea0' : '#9c6553', [0, 0.54, 0], [0.44, 0.54, 0.38])
  s.part(pebble, bird ? '#58ada1' : '#b17d51', [0, 1.15, 0], [0.49, 0.45, 0.44])
  s.part(pebble, bird ? gold : '#eec592', [0, 1.02, 0.32], [0.32, 0.16, 0.27])
  for (const side of [-1, 1]) {
    s.part(pebble, ivory, [side * 0.17, 1.22, 0.33], [0.125, 0.14, 0.1])
    s.part(pebble, navy, [side * 0.17, 1.23, 0.4], [0.07, 0.08, 0.05])
    if (!bird)
      s.part(pebble, '#ae8056', [side * 0.46, 1.14, -0.03], [0.17, 0.19, 0.13])
    s.rod(
      [side * 0.26, 0.63, 0.02],
      [side * 0.6, side < 0 ? 0.91 : 1.1, 0.02],
      0.1,
      bird ? '#287a81' : '#a26a53',
    )
  }
  s.part(stone, bird ? mango : mint, [0, 0.81, 0], [0.42, 0.13, 0.37])
  s.rod([0.55, 0.94, 0.02], [0.58, 1.89, 0.02], 0.029, navy)
  s.part(pennant, bird ? mint : mango, [0.76, 1.88, 0.02], [0.48, 0.46, 0.45])
  return s.mesh().geometry
}
const spectators = [fan(false), fan(true)]
const spectatorPaint = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  flatShading: true,
})
const crowdClock = { value: 0 }
spectatorPaint.onBeforeCompile = (shader) => {
  shader.uniforms.crowdClock = crowdClock
  shader.vertexShader =
    'uniform float crowdClock;\n' +
    shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
    #include <begin_vertex>
    float phase=instanceMatrix[3].z*1.3+instanceMatrix[3].x;
    float beat=sin(crowdClock*4.5+phase);
    transformed.y+=max(beat,0.)*.24;
    transformed.x+=beat*.11*max(position.y,0.);
  `,
    )
}
const fansMatrix = new T.Object3D()
function stands(
  root: T.Group,
  s: Sculpt,
  z: number,
  side: number,
  finish: boolean,
) {
  const x = centerAt(z) + side * (halfWidthAt(z) + 4.2),
    y = elevationAt(z)
  const count = finish ? 13 : 10,
    spacing = 1.3,
    length = (count + 1) * spacing
  for (let row = 0; row < 3; row++) {
    const base = y + 0.65 + row * 0.85,
      xx = x + side * row * 1.4
    s.part(
      box,
      row % 2 ? '#977352' : '#95674c',
      [xx, base - 0.48, z],
      [1.5, 1.1, length],
    )
    s.part(
      box,
      row % 2 ? mint : ivory,
      [xx - side * 0.74, base - 0.27, z],
      [0.1, 0.27, length],
    )
  }
  for (const offset of [-1, 1]) {
    const zz = z + (offset * length) / 2,
      xx = x + side * 2.2
    s.rod([xx, y, zz], [xx, y + 6.9, zz], 0.13, navy)
    for (const stripe of [2, 3, 4])
      s.part(tube, ivory, [xx, y + stripe, zz], [0.14, 0.36, 0.14])
  }
  bunting(
    s,
    [x + side * 2.2, y + 6.8, z - length / 2],
    [x + side * 2.2, y + 6.8, z + length / 2],
    10,
    0.5,
    0.81,
  )
  const batches = [[], []] as T.Matrix4[][]
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < count; i++) {
      const xx = x + side * row * 1.4,
        zz = z + (i - (count - 1) / 2) * spacing
      fansMatrix.position.set(xx, y + 0.66 + row * 0.85, zz)
      fansMatrix.scale.setScalar(0.76 + ((row + i) % 4) * 0.065)
      fansMatrix.rotation.set(
        0,
        -side * Math.PI * 0.43 + 0.3 * Math.sin(i * 17 + row),
        0,
      )
      fansMatrix.updateMatrix()
      batches[(row + i) % 2].push(fansMatrix.matrix.clone())
    }
  batches.forEach((batch, k) => {
    const mesh = new T.InstancedMesh(
      spectators[k],
      spectatorPaint,
      batch.length,
    )
    batch.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.computeBoundingSphere()
    root.add(mesh)
  })
}

function market(s: Sculpt, z: number, side: number, accent: string) {
  const x = centerAt(z) + side * 18,
    y = elevationAt(z)
  for (const dx of [-2.5, 2.5])
    for (const dz of [-3, 3])
      s.rod([x + dx, y - 1, z + dz], [x + dx, y + 4, z + dz], 0.12, '#885a43')
  for (let i = 0; i < 6; i++) {
    const zz = z - 2.75 + i * 1.1
    for (const c of [-1, 1]) {
      s.part(
        box,
        i % 2 ? accent : ivory,
        [x + c * 1.45, y + 4.0, zz],
        [3.16, 0.16, 1.11],
        [0, 0, -c * 0.31],
      )
      s.part(
        pennant,
        i % 2 ? accent : ivory,
        [x + c * 2.96, y + 3.56, zz],
        [1.08, 0.86, 0.62],
        [0, Math.PI / 2, 0],
      )
    }
  }
  s.part(box, '#a06543', [x, y + 0.83, z], [5.2, 1.65, 6.1])
  for (let n = 0; n < 9; n++) {
    const xx = x + ((n % 3) - 1) * 1.52,
      zz = z + (Math.floor(n / 3) - 1) * 1.62
    s.part(box, '#bc8048', [xx, y + 1.75, zz], [1.3, 0.36, 1.4])
    for (let i = 0; i < 4; i++) {
      const bx = xx + ((i % 2) - 0.5) * 0.5,
        bz = zz + (Math.floor(i / 2) - 0.5) * 0.45
      s.part(
        pebble,
        n % 3 === 0 ? '#e8713c' : gold,
        [bx, y + 2.08, bz],
        [0.28, 0.27, 0.36],
        [0, i, 0.3],
      )
    }
  }
}

const waterfallPaint = new T.MeshBasicMaterial({
  vertexColors: true,
  side: T.DoubleSide,
})
const waterTime = { value: 0 }
waterfallPaint.onBeforeCompile = (shader) => {
  shader.uniforms.waterTime = waterTime
  shader.vertexShader =
    'varying vec2 fallCoord;\n' +
    shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nfallCoord=position.xy;',
    )
  shader.fragmentShader =
    'varying vec2 fallCoord; uniform float waterTime;\n' +
    shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
    #include <color_fragment>
    float stripe=smoothstep(.80,.95,sin(fallCoord.y*1.7+waterTime*6.+sin(floor(fallCoord.x*4.0)*143.22)))*.21;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.89,.98,.91),stripe);
  `,
    )
}
function cascade(
  root: T.Group,
  s: Sculpt,
  z: number,
  side: number,
  high: number,
) {
  const x = centerAt(z) + side * 37,
    y = elevationAt(z)
  const water = new Sculpt()
  for (let i = 0; i < 9; i++) {
    const xx = x + (i - 4) * 1.6,
      top = high + 1.2 * Math.sin(i * 0.84)
    s.part(
      stone,
      '#577c79',
      [xx, y + top / 2 - 4, z],
      [2.5, top + 7, 4.5],
      [0, i * 0.9, 0],
    )
    s.part(
      slab,
      '#6da374',
      [xx, y + top - 1, z],
      [2.7, 0.95, 4.8],
      [0, i * 0.9, 0],
    )
    if (i > 0 && i < 8)
      water.part(
        box,
        i % 3 ? '#65d1cc' : '#a6e8dc',
        [xx, y + top * 0.5 - 4.4, z - 3.82],
        [1.68, top + 6.1, 0.65],
        [0.06, 0, 0.012 * Math.sin(i)],
      )
    for (let j = 0; j < 2; j++)
      water.part(
        pebble,
        '#d4f2df',
        [xx + (j - 0.5) * 0.8, y - 5.5, z - 5 - j],
        [1.8, 1.5, 0.98],
      )
  }
  const mesh: T.Mesh = water.mesh()
  mesh.material = waterfallPaint
  mesh.castShadow = false
  root.add(mesh)
}
function rope(s: Sculpt, z: number, side: number) {
  const x = (t: number) => centerAt(t) + side * (halfWidthAt(t) + 0.09)
  for (let j = 0; j < 4; j++) {
    const a = z + j * 4,
      b = a + 4
    for (const level of [0.58, 1.68])
      s.rod(
        [x(a), elevationAt(a) + level - 0.28 * Math.sin((j * Math.PI) / 4), a],
        [
          x(b),
          elevationAt(b) + level - 0.28 * Math.sin(((j + 1) * Math.PI) / 4),
          b,
        ],
        0.067,
        '#bb8d56',
      )
    s.rod(
      [x(a), elevationAt(a) + 0.58, a],
      [x(b), elevationAt(b) + 1.52, b],
      0.038,
      '#a77a4d',
    )
  }
  s.part(tube, '#81583e', [x(z), elevationAt(z) + 0.9, z], [0.18, 1.95, 0.18])
}
function crane(s: Sculpt, z: number, side: number) {
  const x = centerAt(z) + side * 20,
    y = elevationAt(z)
  s.part(box, '#695b5d', [x, y - 0.55, z], [7, 3, 6])
  for (const dx of [-1.1, 1.1])
    for (const dz of [-1.1, 1.1]) {
      s.rod(
        [x + dx * 1.5, y, z + dz * 1.5],
        [x + dx, y + 12, z + dz],
        0.16,
        navy,
      )
    }
  for (let i = 0; i < 4; i++) {
    s.rod(
      [x - 1.3, y + i * 3, z - 1.1],
      [x + 1.3, y + (i + 1) * 3, z - 1.1],
      0.14,
      gold,
    )
    s.rod(
      [x + 1.3, y + i * 3, z - 1.1],
      [x - 1.3, y + (i + 1) * 3, z - 1.1],
      0.14,
      gold,
    )
  }
  s.rod([x + side * 6, y + 12, z], [x - side * 8, y + 12, z], 0.23, mango)
  s.rod([x, y + 15, z], [x - side * 8, y + 12, z], 0.11, navy)
  s.rod([x, y + 15, z], [x + side * 6, y + 12, z], 0.11, navy)
  s.rod([x - side * 7, y + 12, z], [x - side * 7, y + 5, z], 0.055, navy)
  s.part(pebble, '#655862', [x - side * 7, y + 4.5, z], [1.75, 1.5, 1.6])
  s.part(box, mango, [x + side * 4.4, y + 11.9, z], [2.5, 1.8, 2.6])
}
type Vent = { mesh: T.Mesh; y: number; z: number; x: number; phase: number }
export function festivalIsland() {
  const vents: Vent[] = []
  function dress(chunk: T.Group, s: Sculpt, start: number) {
    const inside = (z: number) => z >= start && z < start + 104
    for (const [z, side] of [
      [15, 1],
      [19, -1],
      [62, -1],
      [1416, -1],
      [1458, 1],
      [1464, -1],
    ])
      if (inside(z)) stands(chunk, s, z, side, z > 1400)
    for (const z of [33, 64, 1403, 1448])
      if (inside(z)) {
        const x = centerAt(z),
          y = elevationAt(z),
          w = halfWidthAt(z) + 0.9
        const a: V = [x - w, y + 8.6, z],
          b: V = [x + w, y + 8.9, z + 2]
        for (const p of [a, b]) s.rod([p[0], y, p[2]], p, 0.12, navy)
        bunting(s, a, b, 19, 1.35, 1.1)
      }
    for (const [z, side, color] of [
      [233, 1, mango],
      [251, 1, mint],
      [272, -1, mango],
      [332, 1, mint],
      [394, -1, mango],
      [432, 1, mint],
    ] as const)
      if (inside(z)) market(s, z, side, color)
    for (const [z, side, h] of [
      [79, 1, 16],
      [478, -1, 19],
      [534, 1, 24],
      [588, -1, 20],
      [630, 1, 14],
    ])
      if (inside(z)) cascade(chunk, s, z, side, h)
    for (let z = 464; z <= 608; z += 16)
      if (inside(z)) for (const side of [-1, 1]) rope(s, z, side)
    for (const [z, side] of [
      [718, 1],
      [750, -1],
      [809, 1],
      [861, -1],
      [899, 1],
    ])
      if (inside(z)) {
        const x = centerAt(z) + side * 18,
          y = elevationAt(z)
        for (let i = 0; i < 9; i++) {
          const a = (i * Math.PI * 2) / 9
          s.part(
            stone,
            '#8f655c',
            [x + Math.cos(a) * 2.2, y + 0.1, z + Math.sin(a) * 2.1],
            [0.91, 1.3, 0.91],
            [0, a, 0],
          )
        }
        const plume = new Sculpt()
        for (let i = 0; i < 6; i++)
          plume.part(
            pebble,
            i % 2 ? '#c3b18d' : '#9c8273',
            [Math.sin(i * 2.4) * 0.42, i * 0.82, Math.cos(i * 2.4) * 0.4],
            [1.5 - i * 0.13, 1.2 - i * 0.1, 1.5 - i * 0.12],
          )
        const mesh = plume.mesh()
        mesh.castShadow = false
        chunk.add(mesh)
        vents.push({ mesh, y, z, x, phase: z * 1.24 })
      }
    for (const [z, side] of [
      [943, -1],
      [1004, 1],
      [1134, -1],
      [1187, 1],
    ])
      if (inside(z)) crane(s, z, side)
    for (const z of [1260, 1304, 1378])
      if (inside(z)) {
        const x = centerAt(z),
          y = elevationAt(z)
        for (const side of [-1, 1]) {
          const xx = x + side * 16
          s.part(stone, navy, [xx, y + 2.1, z], [1.05, 4.4, 1.05])
          s.part(slab, gold, [xx, y + 4.4, z], [1.6, 0.7, 1.6])
          s.part(
            pebble,
            mango,
            [xx, y + 5.58, z],
            [0.79, 1.32, 0.75],
            [0, 0.4, side * 0.17],
          )
          s.part(
            pebble,
            gold,
            [xx - side * 0.34, y + 5.35, z - 0.24],
            [0.46, 0.9, 0.47],
          )
        }
      }
  }
  return {
    dress,
    update(time: number, z: number) {
      crowdClock.value = time
      waterTime.value = time
      for (const v of vents)
        if (Math.abs(z - v.z) < 155) {
          const lift = Math.max(
            0.035,
            (Math.sin(time * 2.1 + v.phase) + 0.47) / 1.47,
          )
          v.mesh.position.set(v.x, v.y + 0.45, v.z)
          v.mesh.scale.set(1.4 - lift * 0.4, lift * 1.65, 1.4 - lift * 0.4)
          v.mesh.rotation.y = Math.sin(time * 0.4 + v.phase) * 0.38
        }
    },
  }
}

/** A striped balloon provides a slow-moving skyline landmark from the start and podium. */
export function raceBalloon() {
  const group = new T.Group()
  const hull = new T.SphereGeometry(1, 12, 9).toNonIndexed(),
    attr = hull.attributes.position
  const colors = new Float32Array(attr.count * 3),
    color = new T.Color()
  for (let i = 0; i < attr.count; i += 3) {
    let x = 0,
      z = 0,
      y = 0
    for (let j = i; j < i + 3; j++) {
      x += attr.getX(j)
      z += attr.getZ(j)
      y += attr.getY(j)
    }
    const stripe = Math.floor(
      ((Math.atan2(z, x) + Math.PI) * 6) / Math.PI + 0.01,
    )
    color.set(y / 3 < -0.71 ? '#2d7385' : stripe % 2 ? '#f7d184' : '#ec6847')
    for (let j = i; j < i + 3; j++) {
      color.toArray(colors, j * 3)
      const yy = attr.getY(j)
      const taper = yy < 0 ? 1 + yy * 0.32 : 1
      attr.setXYZ(
        j,
        attr.getX(j) * taper * 2.45,
        yy * 2.96,
        attr.getZ(j) * taper * 2.45,
      )
    }
  }
  hull.setAttribute('color', new T.BufferAttribute(colors, 3))
  hull.computeVertexNormals()
  group.add(
    new T.Mesh(
      hull,
      new T.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.98,
      }),
    ),
  )
  const basket = new Sculpt()
  basket.part(box, '#895c48', [0, -4.55, 0], [1.16, 0.71, 1.05])
  basket.part(box, ivory, [0, -4.36, 0], [1.2, 0.15, 1.09])
  for (const side of [-1, 1])
    for (const dz of [-1, 1]) {
      basket.rod(
        [side * 0.53, -4.2, dz * 0.45],
        [side * 0.72, -2.43, dz * 0.55],
        0.035,
        '#59465a',
      )
    }
  group.add(basket.mesh())
  return group
}

export function finishCrown(x: number, y: number, z: number) {
  const s = new Sculpt()
  s.rod([x, y + 6.35, z], [x, y + 7.18, z], 0.34, navy)
  s.part(slab, gold, [x, y + 7.51, z], [0.96, 1.14, 0.8])
  s.part(stone, '#fff19c', [x, y + 8.17, z], [1.3, 0.12, 1.02])
  for (const side of [-1, 1]) {
    s.rod(
      [x + side * 0.65, y + 7.38, z],
      [x + side * 1.5, y + 7.55, z],
      0.14,
      gold,
    )
    s.rod(
      [x + side * 1.5, y + 7.55, z],
      [x + side * 1.64, y + 8.08, z],
      0.14,
      gold,
    )
    s.rod(
      [x + side * 1.64, y + 8.08, z],
      [x + side * 0.89, y + 8.06, z],
      0.14,
      gold,
    )
    for (let i = 0; i < 3; i++)
      s.part(
        box,
        i % 2 ? ivory : gold,
        [x + side * (2.1 + i * 0.53), y + 6.9 + i * 0.26, z],
        [2.9 - i * 0.33, 0.29, 0.43],
        [0, 0, side * 0.22],
      )
  }
  return s.mesh()
}

export function trackPaint() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!,
    rand = seeded(1917)
  ctx.fillStyle = '#f7f7f7'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 920; i++) {
    const v = 150 + Math.floor(rand() * 105)
    ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'
    const x = rand() * 256,
      y = rand() * 256,
      r = 0.4 + rand() * 1.5
    ctx.beginPath()
    ctx.moveTo(x - r, y)
    ctx.lineTo(x, y - r * 0.6)
    ctx.lineTo(x + 1.6 * r, y)
    ctx.lineTo(x + 0.4 * r, y + r * 0.7)
    ctx.fill()
  }
  for (let i = 0; i < 12; i++) {
    const x = rand() * 256,
      y = rand() * 256
    ctx.fillStyle = '#d8d8d8'
    ctx.fillRect(x, y, 0.6 + rand() * 1.1, 3 + rand() * 7)
  }
  const tex = new T.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = T.RepeatWrapping
  tex.anisotropy = 4
  const m = new T.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.grainTile = { value: tex }
    shader.vertexShader =
      'varying vec2 sandUV;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nsandUV=position.xz*.18;',
      )
    shader.fragmentShader =
      'varying vec2 sandUV; uniform sampler2D grainTile;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb*=mix(1.,texture2D(grainTile,sandUV).r,.73);',
      )
  }
  return m
}
