import { steamFields } from './VentArt.js'
import * as T from 'three'
import {
  ball,
  box,
  cone,
  palette,
  pebble,
  Sculpt,
  seeded,
  tube,
} from './Art.js'
import {
  caldera,
  festivalIsland,
  raceBalloon,
  finishCrown,
  trackPaint,
} from './Island.js'
import { wildlineArt } from './WildlineArt.js'
import { AnimalModel } from './Animals.js'
import {
  bridgeSag,
  BRIDGE_DECK_END,
  recoveryDrop,
  centerAt,
  elevationAt,
  FINISH_Z,
  HAZARDS,
  hazardPose,
  halfWidthAt,
  rainDrop,
  ROAD,
  ZONES,
} from '../../../shared/src/track.js'
import type { Animal, Player, RaceEvent } from '../../../shared/src/protocol.js'

const ink = '#183443',
  orange = '#fa6432',
  cream = '#fff0c6'
type V = [number, number, number]

function leafGeometry() {
  const g = new T.BufferGeometry()
  // A notched silhouette and raised midrib keep each frond legible from below.
  const verts: number[] = []
  const ribs = [0, 0.24, 0.49, 0.73, 1, 1.28, 1.55, 1.83, 2.18]
  const widths = [0.035, 0.25, 0.31, 0.16, 0.35, 0.17, 0.26, 0.13, 0]
  const sections = ribs.map((z, i) => {
    const arc = Math.sin((z / 2.18) * Math.PI) * 0.43 - z * z * 0.056
    return [
      [-widths[i], arc, z],
      [0, arc + 0.11 * (1 - z / 2.2), z],
      [widths[i], arc, z],
    ]
  })
  const face = (a: number[], b: number[], c: number[]) =>
    verts.push(...a, ...b, ...c, ...a, ...c, ...b)
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1],
      b = sections[i]
    for (let n = 0; n < 2; n++) {
      face(a[n], a[n + 1], b[n])
      face(a[n + 1], b[n + 1], b[n])
    }
  }
  g.setAttribute('position', new T.Float32BufferAttribute(verts, 3))
  g.computeVertexNormals()
  return g
}
const leaf = leafGeometry()
function palm(seed: number) {
  const random = seeded(seed),
    s = new Sculpt()
  const lean = (random() - 0.5) * 1.9,
    tip: V = [lean, 5.5, 0.18]
  s.rod([0, 0, 0], [lean * 0.3, 2.7, 0.06], 0.31, '#9a6846').rod(
    [lean * 0.3, 2.65, 0.06],
    tip,
    0.23,
    '#b47d4e',
  )
  for (let i = 1; i < 8; i++)
    s.part(
      tube,
      '#855b41',
      [lean * (i / 8) ** 1.5, (5.5 * i) / 8, (0.18 * i) / 8],
      [0.27 - i * 0.006, 0.075, 0.27 - i * 0.006],
    )
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.4 + random() * 0.25
    const length = i < 7 ? 1.65 : 1.34
    s.part(
      leaf,
      ['#337658', '#428547', '#629e4d', '#8bb74c', '#528f4d'][i % 5],
      tip,
      [1.4, 1, length],
      [i < 7 ? 0.22 : -0.53, angle, 0],
    )
  }
  for (let i = 0; i < 3; i++)
    s.part(
      pebble,
      '#99613d',
      [tip[0] + Math.sin(i * 2) * 0.27, 5.32, Math.cos(i * 2) * 0.29],
      [0.24, 0.33, 0.24],
    )
  return s.mesh()
}
function broadleaf() {
  const s = new Sculpt()
  for (let i = 0; i < 8; i++)
    s.part(
      leaf,
      ['#26785e', '#389765', '#71ae53', '#4b9b66'][i % 4],
      [0, 0, 0],
      [1.7, 1.2, 1.4],
      [i % 2 ? -0.62 : -0.22, i * 0.78, 0],
    )
  return s.mesh()
}
function racingPalm() {
  const s = new Sculpt(),
    frond = new T.BufferGeometry()
  const a = [0, 0, 0],
    b = [-0.55, 0.3, 1.45],
    c = [0, 0.61, 1.6],
    d = [0.55, 0.3, 1.45],
    e = [0, -0.37, 3.1]
  frond.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        a,
        b,
        c,
        a,
        c,
        d,
        b,
        e,
        c,
        c,
        e,
        d,
        c,
        b,
        a,
        d,
        c,
        a,
        c,
        e,
        b,
        d,
        e,
        c,
      ].flat(),
      3,
    ),
  )
  frond.computeVertexNormals()
  s.rod([0, 0, 0], [0.37, 5.3, 0], 0.26, '#ad774b')
  for (let i = 0; i < 8; i++)
    s.part(
      frond,
      ['#39885d', '#69a64f', '#86ad51'][i % 3],
      [0.37, 5.3, 0],
      [1, 1, 1],
      [i % 2 ? -0.21 : 0.12, i * 2.4, 0],
    )
  frond.dispose()
  return s.mesh()
}
function racingShrub() {
  const s = new Sculpt()
  for (let i = 0; i < 5; i++)
    s.part(
      pebble,
      ['#348760', '#5e9e57', '#71ae5d'][i % 3],
      [Math.sin(i) * 0.7, 0.45, Math.cos(i) * 0.7],
      [0.37, 1.03, 0.3],
      [0.65, i * 1.26, 0],
    )
  return s.mesh()
}
function acacia() {
  const s = new Sculpt()
  s.rod([0, 0, 0], [0.1, 3.2, 0], 0.33, '#88654a')
    .rod([0, 2.3, 0], [-1.2, 3.8, 0.12], 0.2, '#856044')
    .rod([0, 2.7, 0], [1.3, 4.08, 0], 0.23, '#88654a')
  s.part(pebble, '#489461', [-1.4, 3.9, 0.15], [2.1, 0.97, 1.9])
    .part(pebble, '#6ea655', [1.15, 4.23, -0.24], [2.18, 1.15, 2.18])
    .part(pebble, '#80af56', [0, 4.6, 0.5], [1.92, 1, 1.77])
  return s.mesh()
}
function bunch(peel = false) {
  const s = new Sculpt()
  for (let i = 0; i < 3; i++) {
    const ang = i * 2.09,
      len = peel ? 0.77 : 0.43
    const mid: V = [
      Math.sin(ang) * len * 0.68,
      peel ? 0.13 : -0.24,
      Math.cos(ang) * len * 0.68,
    ]
    const end: V = [
      Math.sin(ang) * len,
      peel ? -0.1 : 0.11,
      Math.cos(ang) * len,
    ]
    s.rod([0, peel ? 0.4 : 0.02, 0], mid, 0.13, '#ffce31').rod(
      mid,
      end,
      0.1,
      '#ffdf45',
    )
    s.part(pebble, '#785238', end, [0.074, 0.085, 0.077])
  }
  s.part(tube, '#72543c', [0, peel ? 0.45 : 0.13, 0], [0.095, 0.19, 0.095])
  return s.mesh()
}
function mountain(seed: number) {
  const random = seeded(seed)
  const coords: number[] = [],
    colors: number[] = []
  const n = 8,
    ring: V[] = [],
    ridge: V[] = []
  const middle = new T.Color(),
    caps = ['#71b8a0', '#8bc6a2', '#74b79a', '#68ab9a']
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n
    ring.push([Math.cos(a), 0, Math.sin(a)])
    ridge.push([
      Math.cos(a) * (0.36 + 0.19 * random()) + 0.09,
      0.51 + 0.14 * random(),
      Math.sin(a) * 0.43,
    ])
  }
  const face = (a: V, b: V, c: V, col: string) => {
    coords.push(...a, ...b, ...c)
    middle.set(col)
    for (let i = 0; i < 3; i++) colors.push(middle.r, middle.g, middle.b)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    face(ring[i], ridge[i], ring[j], caps[i % 4])
    face(ring[j], ridge[i], ridge[j], caps[i % 4])
    face(ridge[i], [0.22, 1, 0.02], ridge[j], i % 3 ? '#98cbb1' : '#b0d8b9')
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(coords, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return new T.Mesh(g, palette)
}
function cloud() {
  const s = new Sculpt()
  for (const [x, y, r] of [
    [-2, 0, 1.1],
    [-0.85, 0.32, 1.35],
    [0.5, 0.56, 1.5],
    [1.8, 0.06, 1.13],
    [2.6, -0.05, 0.73],
  ])
    s.part(ball, '#fff2ce', [x, y, 0], [r, r * 0.67, r * 0.6])
  return s.mesh()
}
function marker() {
  const s = new Sculpt()
  s.part(tube, cream, [0, 1, 0], [0.1, 2, 0.1]).part(
    box,
    orange,
    [0, 1.84, 0],
    [0.81, 0.5, 0.11],
  )
  s.part(box, cream, [0, 1.87, -0.07], [0.32, 0.09, 0.045]).part(
    box,
    cream,
    [0, 1.87, 0.07],
    [0.32, 0.09, 0.045],
  )
  return s.mesh()
}
const prototypes = {
  racingPalm: racingPalm(),
  racingShrub: racingShrub(),
  palms: [palm(2), palm(19), palm(17)],
  plant: broadleaf(),
  tree: acacia(),
  cloud: cloud(),
  peak: mountain(73),
  marker: marker(),
  banana: bunch(),
  peel: bunch(true),
}

const temp = new T.Object3D()
type Props = Map<T.BufferGeometry, T.Matrix4[]>
function stamp(
  map: Props,
  mesh: T.Mesh,
  x: number,
  y: number,
  z: number,
  size: number | V,
  angle = 0,
) {
  temp.position.set(x, y, z)
  temp.rotation.set(0, angle, 0)
  if (typeof size === 'number') temp.scale.setScalar(size)
  else temp.scale.set(...size)
  temp.updateMatrix()
  const list = map.get(mesh.geometry) ?? []
  list.push(temp.matrix.clone())
  map.set(mesh.geometry, list)
}
function instance(map: Props, root: T.Object3D) {
  map.forEach((matrices, geometry) => {
    const mesh = new T.InstancedMesh(geometry, palette, matrices.length)
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix))
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    root.add(mesh)
  })
}
function banner(text: string, w: number, h: number, flip = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 104
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, 768, 104)
  ctx.fillStyle = orange
  ctx.fillRect(0, 0, 768, 8)
  ctx.fillRect(0, 96, 768, 8)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 2 === 0) {
        ctx.fillStyle = cream
        ctx.fillRect(9 + i * 16, 26 + j * 16, 16, 16)
        ctx.fillRect(694 + i * 16, 26 + j * 16, 16, 16)
      }
    }
  ctx.font = 'italic 900 53px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = cream
  ctx.fillText(text.toUpperCase(), 384, 56, 594)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  const mat = new T.MeshBasicMaterial({ map: texture })
  const group = new T.Group()
  for (const side of [-1, 1]) {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat)
    mesh.rotation.y = side > 0 ? 0 : Math.PI
    mesh.position.z = side * 0.29
    group.add(mesh)
  }
  if (flip) group.rotation.y = Math.PI
  return group
}
function arch(text: string, w: number, h: number) {
  const group = new T.Group(),
    frame = new Sculpt()
  for (const side of [-1, 1]) {
    const x = (side * w) / 2
    frame.part(box, ink, [x, h * 0.5, 0], [0.37, h, 0.48])
    frame.part(box, orange, [x, 0.65, 0], [0.7, 1.3, 0.75])
    for (let j = 0; j < 3; j++)
      frame.part(box, cream, [x, 1.55 + j * 0.54, 0], [0.41, 0.21, 0.5])
  }
  frame.part(box, orange, [0, h, 0], [w + 0.66, 0.33, 0.49])
  group.add(frame.mesh())
  const sign = banner(text, Math.min(w * 0.7, 11), Math.min(w * 0.105, 1.5))
  sign.position.y = h - 0.26
  group.add(sign)
  return group
}
export function sky(scene: T.Scene) {
  scene.background = new T.Color('#8adbdc')
  scene.fog = new T.FogExp2('#b7d9cc', 0.0044)
  const skyMix = { value: 0 },
    stormMix = { value: 0 }
  const skyDome = new T.Mesh(
    new T.SphereGeometry(195, 24, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: { skyMix, stormMix },
      vertexShader: `varying vec3 horizon; void main(){ horizon=normalize(position); mat4 view=mat4(mat3(viewMatrix)); gl_Position=projectionMatrix*view*vec4(position,1.); }`,
      fragmentShader: `varying vec3 horizon;uniform float skyMix;uniform float stormMix;
        float noise(vec2 uv){
          vec2 cells=floor(uv), f=fract(uv);
          f=f*f*(3.-2.*f);
          vec4 corners=fract(sin(vec4(dot(cells,vec2(31.13,17.42)))+vec4(0.,31.13,17.42,48.55))*15384.17);
          return mix(mix(corners.x,corners.y,f.x),mix(corners.z,corners.w,f.x),f.y);
        }
        void main(){
          vec3 p=normalize(horizon);
          vec3 haze=mix(vec3(.89,.90,.76),vec3(.94,.78,.88),skyMix);
          vec3 high=mix(vec3(.13,.65,.82),vec3(.36,.34,.78),skyMix);
          vec3 cloud=mix(vec3(.97,.94,.79),vec3(.88,.79,.91),skyMix);
          vec2 skyUV=p.xz/max(.12,p.y+.10);
          float clouds=noise(skyUV*vec2(1.4,2.8))*.67+noise(skyUV*vec2(3.8,7.5))*.33;
          float wisps=smoothstep(.55,.81,clouds)*smoothstep(.01,.15,p.y)*(1.-smoothstep(.42,.75,p.y))*.42;
          vec3 c=mix(mix(haze,high,smoothstep(-.08,.55,p.y)),cloud,wisps);
          c=mix(c,c*vec3(.74,.82,.87),stormMix);
          gl_FragColor=vec4(c,1.);
        }`,
    }),
  )
  skyDome.renderOrder = -10
  skyDome.frustumCulled = false
  scene.add(skyDome)
  scene.add(new T.HemisphereLight(0xfff4da, 0x7ba6ad, 1.75))
  const light = new T.DirectionalLight(0xffe3bd, 2.15)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  Object.assign(light.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    far: 60,
    near: 0.5,
  })
  light.shadow.normalBias = 0.035
  light.shadow.bias = -0.0004
  scene.add(light, light.target)
  const fog = scene.fog as T.FogExp2,
    baseFog = new T.Color('#b7d9cc'),
    gravityFog = new T.Color('#c2adcf'),
    rainFog = new T.Color('#a8bec6')
  return {
    light,
    update(evt: RaceEvent | null, dt: number) {
      const mix = 1 - Math.exp(-dt * 2)
      skyMix.value = T.MathUtils.lerp(
        skyMix.value,
        evt === 'lowGravity' ? 1 : 0,
        mix,
      )
      stormMix.value = T.MathUtils.lerp(
        stormMix.value,
        evt === 'bananaRain' ? 1 : 0,
        mix,
      )
      fog.color
        .copy(baseFog)
        .lerp(gravityFog, skyMix.value)
        .lerp(rainFog, stormMix.value)
    },
  }
}
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  grad.addColorStop(0, 'rgba(47,44,34,.47)')
  grad.addColorStop(0.61, 'rgba(58,48,30,.24)')
  grad.addColorStop(1, 'rgba(58,48,30,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new T.CanvasTexture(c)
}
let blobMat: T.MeshBasicMaterial | undefined
export function shadow() {
  blobMat ??= new T.MeshBasicMaterial({
    map: shadowTexture(),
    transparent: true,
    depthWrite: false,
  })
  const blob = new T.Mesh(new T.PlaneGeometry(2.6, 2.7), blobMat)
  blob.rotation.x = -Math.PI / 2
  blob.renderOrder = 1
  return blob
}

export function menuDiorama() {
  const group = new T.Group(),
    random = seeded(24),
    map: Props = new Map()
  const road = new Sculpt()
  // Road runs diagonally into a bright bend, framed by uneven jungle banks.
  road.part(box, '#a3bc61', [0, -0.42, -20], [140, 0.36, 110])
  for (let z = -64; z < 14; z += 1.5) {
    const center = -0.2 + Math.sin(z * 0.086) * 2.65
    road.part(box, '#f4b768', [center, -0.15, z], [10.7, 0.3, 1.52])
    for (const side of [-1, 1]) {
      road.part(
        box,
        '#d99854',
        [center + side * 5.4, -0.17, z],
        [0.45, 0.2, 1.52],
      )
      if (z > -30 && random() > 0.55)
        road.part(
          pebble,
          '#e7a963',
          [center + (random() - 0.5) * 9, 0.015, z],
          [0.13 + random() * 0.25, 0.018, 0.042 + random() * 0.13],
        )
    }
  }
  // Print-like tire ruts, scattered sunlit stones and cyan track-side foliage give the foreground depth.
  for (let i = 0; i < 80; i++) {
    const z = -22 + random() * 31,
      x = (random() > 0.5 ? -1 : 1) * (1.5 + random() * 2.5)
    road.part(
      pebble,
      i % 3 ? '#d8a263' : '#f9c984',
      [x + Math.sin(z * 0.09) * 2, 0.023, z],
      [0.11 + random() * 0.19, 0.015, 0.14 + random() * 0.36],
      [0, 0.3, 0],
    )
  }
  const ground = road.mesh()
  ground.castShadow = false
  group.add(ground)
  for (let i = 0; i < 32; i++) {
    const z = 5 - i * 1.65,
      side = i % 2 ? -1 : 1,
      x = side * (6 + random() * 9) + Math.sin(z * 0.086) * 2
    stamp(
      map,
      i % 3
        ? z < -12
          ? prototypes.racingPalm
          : prototypes.palms[i % 3]
        : prototypes.tree,
      x,
      -0.2,
      z,
      0.65 + random() * 0.73,
      random() * 6,
    )
    stamp(
      map,
      z < -12 ? prototypes.racingShrub : prototypes.plant,
      x + side * 0.9,
      -0.18,
      z + 1,
      0.65 + random() * 1.2,
      random() * 6,
    )
  }
  for (const [x, z, size, angle] of [
    [-5.3, 2.6, 1.72, 2],
    [5.5, -1.2, 1.55, 0.9],
    [-5.2, 4.6, 0.8, 1],
    [5.1, 4.6, 0.85, -1],
  ]) {
    stamp(
      map,
      z > 4 ? prototypes.plant : prototypes.palms[2],
      x,
      -0.16,
      z,
      size,
      angle,
    )
  }
  for (let i = 0; i < 10; i++)
    stamp(
      map,
      prototypes.peak,
      -74 + i * 16,
      -6,
      -48 - random() * 20,
      [10 + random() * 11, 8 + random() * 21, 12],
      random() * 6,
    )
  for (const [x, y, z, size] of [
    [-21, 13, -40, 1.6],
    [15, 16, -45, 2],
    [2, 12, -52, 1.8],
    [-4, 8, -42, 0.8],
  ])
    stamp(map, prototypes.cloud, x, y, z, size)
  instance(map, group)
  const volcano = caldera()
  volcano.group.position.set(7, -2.1, -61)
  volcano.group.scale.set(0.56, 0.56, 0.55)
  group.add(volcano.group)
  const balloon = raceBalloon()
  balloon.position.set(-10, 8, -27)
  balloon.scale.setScalar(0.58)
  group.add(balloon)
  const sun = new T.Mesh(
    new T.CircleGeometry(4.6, 48),
    new T.MeshBasicMaterial({ color: '#fff1a1', fog: false }),
  )
  sun.position.set(-15, 13, -39)
  group.add(sun)
  const gantry = arch('Jungle Breakdown', 10.6, 5.1)
  gantry.position.set(-2.25, 0, -14)
  group.add(gantry)
  // Physical pennant strings frame the group and supply an unmistakable race silhouette.
  const flags = new Sculpt()
  for (const side of [-1, 1]) {
    const a: V = [side * 4.9, 3.65, -4],
      b: V = [side * 5.4, 5.45, -16]
    flags.rod([a[0], 0, a[2]], a, 0.09, ink).rod(a, b, 0.026, ink)
    for (let i = 1; i < 12; i++) {
      const f = i / 12,
        x = a[0] + (b[0] - a[0]) * f,
        y = a[1] + (b[1] - a[1]) * f,
        z = a[2] + (b[2] - a[2]) * f
      flags.part(
        cone,
        i % 2 ? orange : cream,
        [x, y - 0.15, z],
        [0.27, 0.55, 0.35],
        [0, 0, Math.PI],
      )
    }
  }
  group.add(flags.mesh())
  const cast: [Animal, number, number, number, number][] = [
    ['elephant', 0.66, 0, 1.27, 0.48],
    ['penguin', -1.53, 1.42, 1.06, -0.26],
    ['turtle', 2.66, 1.1, 1.0, -0.66],
    ['gorilla', -3.24, -1.85, 1.2, 0.68],
  ]
  const actors = cast.map(([animal, x, z, size, yaw], i) => {
    const model = new AnimalModel(animal)
    model.group.position.set(x, 0, z)
    model.group.rotation.y = yaw
    model.group.scale.setScalar(size)
    group.add(model.group)
    const blob = shadow()
    blob.position.set(x, 0.035, z)
    blob.scale.setScalar(size)
    group.add(blob)
    return { model, blob, animal, x, z, offset: i * 1.38 }
  })
  return {
    group,
    update(time: number) {
      volcano.update(time)
      balloon.position.y = 7.8 + 0.28 * Math.sin(time * 0.45)
      balloon.rotation.z = 0.045 * Math.sin(time * 0.36)
      actors.forEach(({ model, blob, animal, x, z, offset }) => {
        const stride = time * 1.6 + offset
        model.group.position.set(
          x + Math.sin(stride * 0.43) * 0.13,
          animal === 'gorilla'
            ? 0.5 + Math.abs(Math.sin(stride * 0.7)) * 0.62
            : Math.abs(Math.sin(stride)) * 0.11,
          z + Math.sin(stride * 0.66) * 0.21,
        )
        model.group.rotation.z =
          (animal === 'elephant'
            ? -0.08
            : animal === 'penguin'
              ? 0.11
              : 0.025) +
          Math.sin(stride) * 0.035
        model.group.rotation.x =
          animal === 'gorilla' ? -0.13 : animal === 'turtle' ? 0.11 : 0
        blob.position.x = model.group.position.x
        blob.position.z = model.group.position.z
        model.pose(
          time + offset,
          0.93,
          animal === 'gorilla',
          animal === 'gorilla',
          0,
        )
      })
    },
  }
}

function obstacles() {
  return HAZARDS.map((h) => {
    let mesh: T.Mesh
    if (h.kind === 'banana' || h.kind === 'peel')
      mesh = prototypes[h.kind].clone()
    else {
      const s = new Sculpt()
      if (h.kind === 'boulder')
        s.part(
          pebble,
          '#797b73',
          [0, 0, 0],
          [h.width * 0.55, h.height * 0.54, h.depth * 0.54],
        )
      else if (h.kind === 'log') {
        s.rod(
          [-h.width / 2, 0, 0],
          [h.width / 2, 0, 0],
          h.height * 0.5,
          '#905d3d',
        )
        for (const side of [-1, 1])
          s.rod(
            [side * h.width * 0.5, 0, 0],
            [side * (h.width * 0.5 + 0.035), 0, 0],
            h.height * 0.42,
            '#d5a366',
          )
      } else {
        s.part(
          box,
          h.kind === 'spinner' ? orange : ink,
          [0, 0, 0],
          [h.width, h.height, h.depth],
        )
        for (let j = 0; j < 5; j++)
          s.part(
            box,
            j % 2 ? cream : orange,
            [(j - 2) * h.width * 0.185, 0, 0],
            [h.width * 0.08, h.height * 1.025, h.depth * 1.025],
          )
        if (h.kind === 'spinner') s.part(tube, ink, [0, 0, 0], [0.6, 1.7, 0.6])
      }
      mesh = s.mesh()
    }
    return { h, mesh }
  })
}
export function course() {
  const group = new T.Group()
  const festival = festivalIsland()
  const roadMaterial = trackPaint()
  const volcano = caldera()
  group.add(volcano.group)
  const updateGates = wildlineArt(group)
  const updateVents = steamFields(group)
  const hues: Record<string, string> = {
    dirt: '#e8b479',
    bridge: '#b98754',
    grass: '#93ae59',
    mud: '#925f49',
    rock: '#d4a976',
  }
  const deck: { mesh: T.Mesh; z: number }[] = []
  const block = box.clone()
  block.translate(0, -0.5, 0)
  const chunks = new Map<number, T.Group>()
  // Build nearby sections on demand; a first-time lobby only needs the starting area.
  function buildChunk(start: number) {
    const chunk = new T.Group()
    const random = seeded(start + 680)
    const road = new Sculpt(),
      map: Props = new Map()
    festival.dress(chunk, road, start)
    for (const patch of ROAD.filter((p) => p.z >= start && p.z < start + 104)) {
      const { x, y, z, width, length, tilt, surface } = patch
      const slice = surface === 'bridge' ? new Sculpt() : road
      slice.part(
        block,
        surface === 'dirt' && patch.zone === 5 ? '#d89c71' : hues[surface],
        [x, y, z],
        [width, surface === 'bridge' ? 0.46 : 1.6, length + 0.04],
        [tilt, 0, 0],
      )
      if (surface === 'dirt' || surface === 'mud') {
        // Interrupted grooves follow the slope while the crown stays clear for the racing line.
        for (const side of [-1, 1]) {
          const xx = x + side * (width * 0.23 + Math.sin(z * 0.052) * 0.74)
          slice.part(
            box,
            surface === 'mud' ? '#7e5545' : '#dbac77',
            [xx, y + 0.036, z],
            [0.16 + random() * 0.18, 0.032, length * 0.91],
            [tilt, Math.sin(z * 0.058) * 0.11, 0],
          )
          if (surface === 'mud' && z % 16 < 8) {
            slice.part(
              pebble,
              '#a3a589',
              [xx, y + 0.047, z],
              [1.7, 0.036, 2.8],
              [tilt, 0, 0],
            )
          }
        }
      }
      if (surface === 'bridge')
        for (let i = -3; i <= 3; i += 1.15) {
          slice.part(
            box,
            '#8e6549',
            [x, y - Math.sin(tilt) * i + 0.025, z + i],
            [width, 0.046, 0.07],
            [tilt, 0, 0],
          )
        }
      if (surface === 'bridge') {
        const mesh = slice.mesh()
        deck.push({ mesh, z })
        chunk.add(mesh)
      }
      if (surface === 'dirt' || surface === 'rock') {
        for (const side of [-1, 1]) {
          const t = side * (width / 2 - 0.32)
          // Twin painted rumble strips give the course an edge that remains legible at racing speed.
          if (patch.zone === 0 || patch.zone === 5) {
            for (let n = 0; n < 2; n++) {
              const dz = (n - 0.5) * 3.8
              slice.part(
                box,
                (Math.floor(z / 8) + n) % 2 ? '#e7663d' : '#f6dd9f',
                [x + t, y - Math.sin(tilt) * dz + 0.032, z + dz],
                [0.85, 0.08, 3.85],
                [tilt, 0, 0],
              )
            }
          }
          slice.part(
            box,
            patch.zone === 5 ? '#f08a57' : '#f5d696',
            [x + t, y + 0.027, z],
            [0.33, 0.05, 4.6],
            [tilt, 0, 0],
          )
        }
      }
      if (surface === 'dirt' || surface === 'rock')
        for (let j = 0; j < 10; j++) {
          const dz = (random() - 0.5) * length
          road.part(
            pebble,
            j % 4 === 0 ? '#f3c88b' : '#d6a371',
            [
              x + (random() - 0.5) * (width - 1),
              y - Math.sin(tilt) * dz + 0.029,
              z + dz,
            ],
            [0.18 + random() * 0.35, 0.023, 0.09],
          )
        }
    }
    for (let z = start; z < Math.min(start + 104, FINISH_Z + 40); z += 8) {
      const x = centerAt(z),
        y = elevationAt(z) - (z >= BRIDGE_DECK_END ? recoveryDrop(z) : 0),
        width = halfWidthAt(z)
      for (const side of [-1, 1]) {
        if (width > 6 && z % 16 === 0 && z > 85 && z < 1400) {
          const bank = width + 10
          const soil =
            z >= 664 && z < 920
              ? '#936b59'
              : z >= 920 && z < 1200
                ? '#77737a'
                : '#8b765d'
          road.part(
            pebble,
            soil,
            [x + side * bank, y - 5.2, z],
            [12, 7, 15],
            [0, random() * 0.65, 0],
          )
          road.part(
            pebble,
            z >= 920 && z < 1200 ? '#91a766' : '#71a368',
            [x + side * (bank + 0.8), y - 2.65, z],
            [11, 4.8, 14],
            [0, 0.25, 0],
          )
        }
        if (z % 24 === 0)
          stamp(map, prototypes.marker, x + side * (width - 0.15), y, z, 1)
        if (width < 6 && z < BRIDGE_DECK_END && z % 16 === 0) {
          road.part(
            tube,
            '#956c44',
            [x + side * width, y + 0.48, z],
            [0.13, 1, 0.13],
          )
        }
        // Open sight lines at the grandstands, cliff faces and crowded bazaar.
        const landmark =
          z < 80 || (z > 215 && z < 455) || (z > 457 && z < 640) || z > 1400
        const off =
            width + (landmark ? 23 : 8) + random() * (landmark ? 16 : 12),
          xx = x + side * off
        road.part(
          pebble,
          '#7aab68',
          [xx, y - 2.4, z],
          [7 + random() * 6, 2.65, 7 + random() * 6],
        )
        stamp(
          map,
          z % 24 === 0 ? prototypes.tree : prototypes.racingPalm,
          xx,
          y - 0.25,
          z,
          0.75 + random() * 0.8,
          random() * 6,
        )
        stamp(
          map,
          prototypes.racingShrub,
          xx + side * 2,
          y - 0.4,
          z + 2,
          0.5 + random() * 1.05,
          random() * 6,
        )
        if (z % 48 === 0)
          stamp(
            map,
            prototypes.peak,
            x + side * (51 + random() * 24),
            y - 11,
            z,
            [16 + random() * 12, 15 + random() * 20, 26],
            random() * 6,
          )
      }
    }
    const terrain = road.mesh()
    terrain.material = roadMaterial
    chunk.add(terrain)
    instance(map, chunk)
    chunks.set(start, chunk)
    group.add(chunk)
  }
  let lastSection = -1
  function stream(z: number) {
    const section = Math.floor((z + 32) / 104)
    if (section === lastSection) return
    lastSection = section
    for (let n = Math.max(0, section - 2); n <= section + 2; n++) {
      const start = n * 104 - 32
      if (start < FINISH_Z + 40 && !chunks.has(start)) buildChunk(start)
    }
    for (const [start, chunk] of chunks)
      chunk.visible = Math.abs(Math.floor((start + 32) / 104) - section) <= 2
  }
  const water = new T.Mesh(
    new T.PlaneGeometry(650, FINISH_Z + 600),
    new T.MeshStandardMaterial({
      color: '#51b8b0',
      flatShading: true,
      roughness: 0.9,
    }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(0, -7.5, FINISH_Z * 0.5)
  group.add(water)
  for (const [z, label] of [
    [11, 'Wildline Rally'],
    ...ZONES.slice(1).map((zone) => [zone.start, zone.name]),
    [FINISH_Z, 'Finish'],
  ] as [number, string][]) {
    const gate = arch(label, halfWidthAt(z) * 2 + 0.3, 6.2)
    gate.position.set(centerAt(z), elevationAt(z), z)
    group.add(gate)
  }
  group.add(finishCrown(centerAt(FINISH_Z), elevationAt(FINISH_Z), FINISH_Z))
  const balloons = [raceBalloon(), raceBalloon()]
  for (const [i, b] of balloons.entries()) {
    b.position.set(i === 0 ? 26 : -23, i === 0 ? 16 : 26, i === 0 ? 94 : 1437)
    b.scale.setScalar(i === 0 ? 1.15 : 1.65)
    group.add(b)
  }
  const starter = new T.Group()
  starter.position.set(centerAt(11), elevationAt(11) + 5.11, 10.55)
  const surround = new Sculpt().part(box, ink, [0, 0, 0], [4.1, 0.9, 0.48])
  starter.add(surround.mesh())
  const bulbs = Array.from({ length: 3 }, (_, i) => {
    const lamp = new T.Mesh(ball, new T.MeshBasicMaterial({ color: '#a98a56' }))
    lamp.position.set((i - 1) * 1.22, 0, -0.25)
    lamp.scale.set(0.33, 0.33, 0.16)
    starter.add(lamp)
    return lamp
  })
  group.add(starter)
  const stripes = new Sculpt()
  for (const z of [0, FINISH_Z]) {
    const width = halfWidthAt(z) * 2
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 24; col++) {
        stripes.part(
          box,
          (row + col) % 2 ? cream : ink,
          [
            centerAt(z) - width / 2 + ((col + 0.5) * width) / 24,
            elevationAt(z) + 0.031,
            z + row * 0.7,
          ],
          [width / 24, 0.052, 0.71],
        )
      }
  }
  for (let i = 0; i < 8; i++) {
    const z = -3 * Math.floor(i / 4),
      x = centerAt(z) + ((i % 4) - 1.5) * 2.3
    for (const side of [-1, 1])
      stripes.part(
        box,
        cream,
        [x + side * 0.8, 0.032, z - 0.4],
        [0.09, 0.025, 1.4],
      )
    stripes.part(box, cream, [x, 0.032, z - 1.1], [1.6, 0.025, 0.09])
  }
  group.add(stripes.mesh())
  const hazards = obstacles()
  for (const { mesh } of hazards) group.add(mesh)
  const rain = Array.from({ length: 21 }, () => {
    const mesh = prototypes.peel.clone()
    mesh.visible = false
    group.add(mesh)
    return mesh
  })
  let prevRain = false
  function update(
    t: number,
    evt: RaceEvent | null,
    eventCenter: number,
    eventAge: number,
    racers: Player[],
    viewer: Player,
    countdown: number,
    visualTime: number,
  ) {
    const hill =
      T.MathUtils.smoothstep(viewer.z, 890, 974) *
      (1 - T.MathUtils.smoothstep(viewer.z, 1150, 1220))
    const eruption = updateVents(t, viewer.z)
    volcano.group.position.set(
      centerAt(viewer.z) * 0.25 - 41 + 11 * Math.sin(viewer.z / 260),
      -7 + hill * 9,
      viewer.z + 128 + hill * 12,
    )
    volcano.group.scale.setScalar(1 + hill * 0.10)
    volcano.update(visualTime, eruption)
    balloons.forEach((b, i) => {
      b.position.y =
        (i === 0 ? 16 : 26) + 0.65 * Math.sin(visualTime * 0.42 + i)
      b.rotation.z = Math.sin(visualTime * 0.31 + i) * 0.07
    })
    festival.update(visualTime, viewer.z)
    updateGates(viewer, t)
    bulbs.forEach((bulb, i) =>
      bulb.material.color.set(
        countdown > 0
          ? 3 - countdown >= i
            ? '#ff7544'
            : '#806a65'
          : '#8cf59b',
      ),
    )
    for (const slab of deck) slab.mesh.position.y = -bridgeSag(slab.z, racers)
    for (const { mesh, h } of hazards) {
      const p = hazardPose(h, t)
      mesh.position.set(p.x, p.y, p.z)
      mesh.rotation.y = p.yaw
      if (h.kind === 'boulder') mesh.rotation.x = (p.z - h.z) * 0.6
      if (h.kind === 'banana') {
        mesh.rotation.y = t * 2
        mesh.position.y += Math.sin(t * 3) * 0.07
      }
    }
    const falling = evt === 'bananaRain'
    if (falling || prevRain)
      rain.forEach((mesh, i) => {
        mesh.visible = falling
        if (falling) {
          const p = rainDrop(i, eventCenter, eventAge)
          mesh.position.set(p.x, p.y, p.z)
          mesh.rotation.y = i
        }
      })
    prevRain = falling
  }
  const ray = new T.Ray(),
    bounds = new T.Box3(),
    hit = new T.Vector3()
  const blockers = hazards.filter(
    ({ h }) => h.kind !== 'banana' && h.kind !== 'peel',
  )
  function avoidObstacle(origin: T.Vector3, desired: T.Vector3) {
    const distance = origin.distanceTo(desired)
    if (distance < 0.01) return false
    ray.origin.copy(origin)
    ray.direction.subVectors(desired, origin).divideScalar(distance)
    let safe = distance
    for (const { h, mesh } of blockers) {
      if (Math.abs(mesh.position.z - origin.z) > distance + h.width) continue
      const c = Math.abs(Math.cos(mesh.rotation.y)),
        s = Math.abs(Math.sin(mesh.rotation.y))
      const hx = (h.width * c + h.depth * s) * 0.5 + 0.12,
        hz = (h.width * s + h.depth * c) * 0.5 + 0.12
      bounds.min.set(
        mesh.position.x - hx,
        mesh.position.y - h.height * 0.5 - 0.12,
        mesh.position.z - hz,
      )
      bounds.max.set(
        mesh.position.x + hx,
        mesh.position.y + h.height * 0.5 + 0.12,
        mesh.position.z + hz,
      )
      if (!bounds.containsPoint(origin) && ray.intersectBox(bounds, hit))
        safe = Math.min(safe, Math.max(0.8, origin.distanceTo(hit) - 0.22))
    }
    if (safe >= distance) return false
    ray.at(safe, desired)
    return true
  }
  return { group, update, stream, avoidObstacle }
}
