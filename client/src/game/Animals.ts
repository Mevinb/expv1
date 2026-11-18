import * as T from 'three'
import type { Animal } from '../../../shared/src/protocol.js'
import { ball, pebble, Sculpt, tube } from './Art.js'

const EYE = '#292333',
  MILK = '#fff1cf',
  coral = '#ff5b35'
const models = new Map<Animal, T.Group>()
type Vec = [number, number, number]

function eyes(
  s: Sculpt,
  x: number,
  y: number,
  z: number,
  radius: number,
  splay = 0.025,
) {
  for (const side of [-1, 1]) {
    s.part(ball, MILK, [side * x, y, z], [radius, radius * 1.16, radius * 0.66])
    s.part(
      ball,
      EYE,
      [side * (x - splay), y, z + radius * 0.48],
      [radius * 0.67, radius * 0.83, radius * 0.36],
    )
    s.part(
      ball,
      '#ffffff',
      [
        side * (x - splay) - radius * 0.16,
        y + radius * 0.25,
        z + radius * 0.78,
      ],
      [radius * 0.2, radius * 0.23, radius * 0.13],
    )
  }
}
function limb(parent: T.Object3D, name: string, pivot: Vec, s: Sculpt) {
  const joint = new T.Group()
  joint.name = name
  joint.position.set(...pivot)
  joint.add(s.mesh())
  parent.add(joint)
}
function elephant(root: T.Group) {
  const lilac = '#a997e8',
    shade = '#897dce',
    rose = '#edb7d6'
  const body = new Sculpt()
  body.part(ball, lilac, [0, 1.05, -0.09], [0.85, 0.81, 1.0])
  body.part(ball, '#f77950', [0, 1.21, 0.48], [0.73, 0.66, 0.32])
  body.part(
    pebble,
    coral,
    [0.34, 0.95, 0.55],
    [0.29, 0.59, 0.15],
    [0.15, 0, 0.35],
  )
  body
    .rod([0, 1.2, -0.88], [0.13, 0.73, -1.19], 0.074, shade)
    .part(pebble, shade, [0.13, 0.72, -1.19], [0.12, 0.18, 0.11])
  root.add(body.mesh())
  const head = new Sculpt().part(ball, lilac, [0, 0.12, 0], [0.87, 0.84, 0.66])
  for (const side of [-1, 1]) {
    head.part(
      ball,
      shade,
      [side * 0.82, 0.16, -0.08],
      [0.56, 0.72, 0.24],
      [0, side * 0.2, side * -0.28],
    )
    head.part(
      ball,
      rose,
      [side * 0.93, 0.14, 0.1],
      [0.37, 0.54, 0.12],
      [0, side * 0.2, side * -0.28],
    )
    head.part(ball, '#eac0e3', [side * 0.52, -0.09, 0.43], [0.17, 0.09, 0.09])
    head.rod(
      [side * 0.43, -0.26, 0.42],
      [side * 0.46, -0.37, 0.72],
      0.115,
      MILK,
    )
    head.rod(
      [side * 0.46, -0.37, 0.72],
      [side * 0.45, -0.27, 0.87],
      0.071,
      MILK,
    )
  }
  eyes(head, 0.35, 0.28, 0.535, 0.193)
  for (const side of [-1, 1])
    head.part(
      pebble,
      '#68547a',
      [side * 0.35, 0.5, 0.493],
      [0.2, 0.047, 0.055],
      [0, 0, side * 0.18],
    )
  // A crimson headband with a knot and two loose tails.
  head.part(
    ball,
    coral,
    [0, 0.55, -0.015],
    [0.77, 0.235, 0.58],
    [-0.1, 0, 0.035],
  )
  head.part(ball, lilac, [0, 0.71, -0.035], [0.64, 0.24, 0.5])
  head.part(pebble, coral, [0.68, 0.48, -0.22], [0.19, 0.15, 0.16])
  head.part(
    pebble,
    coral,
    [0.84, 0.38, -0.28],
    [0.13, 0.32, 0.1],
    [0, 0, -0.78],
  )
  limb(root, 'head', [0, 1.65, 0.5], head)
  const trunk = new Sculpt()
  trunk
    .rod([0, 0.12, 0], [0, -0.28, 0.18], 0.21, lilac)
    .part(ball, lilac, [0, -0.29, 0.17], [0.2, 0.19, 0.18])
  trunk
    .rod([0, -0.29, 0.17], [0.12, -0.53, 0.42], 0.17, lilac)
    .part(ball, lilac, [0.12, -0.52, 0.42], [0.17, 0.16, 0.17])
  trunk
    .rod([0.12, -0.52, 0.42], [0.3, -0.4, 0.67], 0.145, lilac)
    .part(ball, shade, [0.3, -0.4, 0.67], [0.144, 0.13, 0.12])
  trunk
    .part(ball, '#665695', [0.27, -0.355, 0.76], [0.045, 0.037, 0.027])
    .part(ball, '#665695', [0.355, -0.355, 0.75], [0.036, 0.033, 0.025])
  limb(root.getObjectByName('head')!, 'trunk', [0, 0.06, 0.59], trunk)
  for (const side of [-1, 1])
    for (const row of [-1, 1]) {
      const s = new Sculpt()
        .part(tube, lilac, [0, -0.23, 0], [0.27, 0.55, 0.28])
        .part(ball, shade, [0, -0.49, 0.045], [0.29, 0.19, 0.34])
      for (const toe of [-1, 0, 1])
        s.part(
          ball,
          '#d6c6e6',
          [toe * 0.12, -0.51, 0.31],
          [0.062, 0.075, 0.036],
        )
      limb(root, 'leg' + side + row, [side * 0.5, 0.67, row * 0.5 - 0.1], s)
    }
}
function penguin(root: T.Group) {
  const navy = '#273747',
    cream = '#fff2cf',
    gold = '#ffae35'
  const body = new Sculpt().part(
    ball,
    navy,
    [0, 0.9, -0.06],
    [0.55, 0.81, 0.53],
  )
  body
    .part(ball, cream, [0, 0.88, 0.31], [0.43, 0.61, 0.23])
    .part(ball, '#f36e3f', [0, 1.27, 0], [0.54, 0.18, 0.51])
  body.part(
    pebble,
    coral,
    [0.44, 1.15, -0.17],
    [0.16, 0.35, 0.14],
    [0, 0, -0.42],
  )
  root.add(body.mesh())
  const h = new Sculpt().part(ball, navy, [0, 0, 0], [0.57, 0.55, 0.49])
  for (const side of [-1, 1])
    h.part(ball, cream, [side * 0.19, 0.01, 0.31], [0.27, 0.31, 0.18])
  eyes(h, 0.21, 0.1, 0.44, 0.098)
  h.part(pebble, gold, [0, -0.055, 0.55], [0.2, 0.12, 0.23])
  limb(root, 'head', [0, 1.53, 0.01], h)
  for (const side of [-1, 1]) {
    limb(
      root,
      'arm' + side,
      [side * 0.43, 1.2, 0],
      new Sculpt().part(
        ball,
        navy,
        [side * 0.16, -0.22, -0.04],
        [0.16, 0.46, 0.2],
        [0, 0, side * 0.38],
      ),
    )
    limb(
      root,
      'leg' + side + '1',
      [side * 0.27, 0.31, 0.02],
      new Sculpt().part(pebble, gold, [0, -0.18, 0.16], [0.25, 0.15, 0.4]),
    )
  }
}
function gorilla(root: T.Group) {
  const fur = '#514450',
    dark = '#393741',
    tan = '#c19173'
  const body = new Sculpt().part(ball, fur, [0, 1.01, -0.1], [0.86, 0.86, 0.65])
  body
    .part(ball, tan, [0, 1.06, 0.3], [0.59, 0.53, 0.3])
    .part(ball, coral, [0, 1.57, 0.02], [0.66, 0.19, 0.46])
  root.add(body.mesh())
  const head = new Sculpt().part(ball, fur, [0, 0, 0], [0.63, 0.61, 0.5])
  for (const side of [-1, 1]) {
    head.part(ball, tan, [side * 0.57, 0.04, -0.04], [0.18, 0.2, 0.1])
    head.part(ball, tan, [side * 0.21, 0.06, 0.34], [0.26, 0.24, 0.17])
  }
  eyes(head, 0.235, 0.09, 0.45, 0.103)
  head
    .part(ball, tan, [0, -0.15, 0.38], [0.44, 0.24, 0.26])
    .part(ball, dark, [0, -0.055, 0.57], [0.235, 0.135, 0.12])
  head.part(ball, '#e9b68d', [0, -0.3, 0.46], [0.27, 0.06, 0.13])
  for (const side of [-1, 1])
    head.part(
      pebble,
      fur,
      [side * 0.24, 0.23, 0.44],
      [0.28, 0.09, 0.1],
      [0, 0, side * 0.16],
    )
  limb(root, 'head', [0, 1.87, 0.22], head)
  for (const side of [-1, 1]) {
    const arm = new Sculpt().part(
      ball,
      fur,
      [side * 0.12, -0.24, 0],
      [0.38, 0.52, 0.4],
    )
    arm
      .part(ball, dark, [side * 0.18, -0.64, 0.11], [0.31, 0.43, 0.36])
      .part(ball, tan, [side * 0.19, -0.91, 0.21], [0.3, 0.2, 0.3])
    limb(root, 'arm' + side, [side * 0.71, 1.55, 0], arm)
    limb(
      root,
      'leg' + side + '1',
      [side * 0.4, 0.67, -0.2],
      new Sculpt()
        .part(ball, fur, [0, -0.24, 0], [0.29, 0.39, 0.3])
        .part(ball, dark, [0, -0.52, 0.12], [0.29, 0.17, 0.32]),
    )
  }
}
function turtle(root: T.Group) {
  const green = '#9cb75c',
    shell = '#537e50',
    cream = '#f1d480'
  const body = new Sculpt()
    .part(ball, cream, [0, 0.52, 0], [0.7, 0.42, 0.89])
    .part(ball, shell, [0, 0.71, -0.06], [0.74, 0.55, 0.89])
  for (const side of [-1, 1])
    for (const row of [-1, 1]) {
      body.part(
        pebble,
        '#769e55',
        [side * 0.38, 1.06, row * 0.33 - 0.08],
        [0.32, 0.14, 0.33],
        [0, 0, side * -0.45],
      )
      limb(
        root,
        'leg' + side + row,
        [side * 0.45, 0.44, row * 0.45],
        new Sculpt().part(
          ball,
          green,
          [side * 0.09, -0.18, 0],
          [0.21, 0.2, 0.26],
        ),
      )
    }
  body.part(pebble, '#85a454', [0, 1.22, -0.06], [0.36, 0.12, 0.4])
  body.part(pebble, green, [0, 0.5, -0.91], [0.16, 0.15, 0.33])
  root.add(body.mesh())
  const head = new Sculpt().part(ball, green, [0, 0, 0.09], [0.42, 0.37, 0.46])
  head.part(ball, '#f3cd83', [0, -0.125, 0.26], [0.38, 0.19, 0.3])
  for (const side of [-1, 1]) {
    head.part(ball, '#de633e', [side * 0.215, 0.14, 0.37], [0.19, 0.185, 0.12])
    head.part(ball, '#413946', [side * 0.215, 0.14, 0.425], [0.16, 0.15, 0.09])
  }
  eyes(head, 0.215, 0.15, 0.46, 0.09)
  limb(root, 'head', [0, 0.72, 0.77], head)
}

export class AnimalModel {
  readonly group = new T.Group()
  private readonly model: T.Group
  private readonly joints = new Map<string, T.Object3D>()
  constructor(readonly animal: Animal) {
    if (!models.has(animal)) {
      const prototype = new T.Group()
      ;({ elephant, penguin, gorilla, turtle })[animal](prototype)
      models.set(animal, prototype)
    }
    this.model = models.get(animal)!.clone(true)
    this.model.traverse((o) => {
      if (o.name) this.joints.set(o.name, o)
    })
    this.group.add(this.model)
  }
  pose(
    t: number,
    pace: number,
    active: boolean,
    airborne: boolean,
    hit: number,
  ) {
    const cycle = t * 9,
      stride = Math.min(1, pace)
    const foot = Math.sin(cycle) * stride
    const roll = this.animal === 'turtle' && active
    const slide = this.animal === 'penguin' && active
    this.model.rotation.set(
      slide ? 1.2 : 0,
      0,
      roll ? t * 16 : Math.sin(cycle) * 0.03 * stride + hit * 0.2,
    )
    this.model.position.y = roll ? 0.08 : slide ? 0.04 : Math.abs(foot) * 0.1
    this.model.scale.set(1 + hit * 0.08, 1 - hit * 0.13, 1 + hit * 0.08)
    for (const side of [-1, 1]) {
      for (const row of [-1, 1]) {
        const leg = this.joints.get('leg' + side + row)
        if (leg) {
          leg.rotation.x = roll
            ? -0.8
            : foot * side * row * 0.58 + (airborne ? -0.27 : 0)
          leg.visible = !roll
        }
      }
      const arm = this.joints.get('arm' + side)
      if (arm)
        arm.rotation.set(
          active && this.animal === 'gorilla' ? -2.4 : foot * side * 0.7,
          0,
          Math.sin(cycle) * 0.04,
        )
    }
    const head = this.joints.get('head')!
    head.visible = !roll
    head.rotation.set(
      Math.sin(t * 3) * 0.025 - foot * 0.055,
      Math.sin(t * 2.3) * 0.035,
      foot * 0.04,
    )
    const trunk = this.joints.get('trunk')
    if (trunk)
      trunk.rotation.set(
        active ? -0.42 : foot * 0.12,
        Math.sin(t * 3) * 0.08,
        Math.sin(t * 3) * 0.07,
      )
  }
}
