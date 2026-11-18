import { elevationAt } from '../../../shared/src/track.js'
import * as T from 'three'
import { box, pebble, Sculpt } from './Art.js'
import { WILDLINE_GATES } from '../../../shared/src/wildlines.js'
import type { Player } from '../../../shared/src/protocol.js'

const metal = '#84512c',
  gold = '#ffb825',
  light = '#fff5b5'
type V = [number, number, number]

/** Suspended brass timing gates. Only the next gate carries the bright racing line. */
export function wildlineArt(root: T.Group) {
  const ready = new T.MeshBasicMaterial({ vertexColors: true })
  const closed = new T.MeshBasicMaterial({ color: '#626355' })
  const hit = new T.MeshBasicMaterial({ color: '#8df9c4' })
  const missed = new T.MeshBasicMaterial({ color: '#ce8360' })
  const gates = WILDLINE_GATES.map((g) => {
    const s = new Sculpt(),
      w = g.halfWidth,
      h = g.height
    for (const side of [-1, 1]) {
      const path: V[] = [
        [side * w, 0.1, 0],
        [side * w, h * 0.53, 0],
        [side * w * 0.78, h * 0.85, 0],
        [side * w * 0.35, h, 0],
        [0, h, 0],
      ]
      for (let i = 0; i < path.length - 1; i++) {
        s.rod(path[i], path[i + 1], 0.135, gold)
        const a = path[i],
          b = path[i + 1]
        s.rod([a[0], a[1], -0.13], [b[0], b[1], -0.13], 0.047, light)
      }
      s.part(box, metal, [side * w, 0.34, 0], [0.48, 0.6, 0.52])
      s.part(box, gold, [side * w, 0.54, 0], [0.5, 0.1, 0.54])
      s.part(pebble, light, [side * w, h * 0.5, -0.03], [0.23, 0.23, 0.14])
    }
    s.part(pebble, gold, [0, h + 0.17, 0], [0.41, 0.48, 0.15])
    s.part(pebble, light, [0, h + 0.17, -0.11], [0.22, 0.27, 0.09])
    const frame = s.mesh()
    frame.position.set(g.x, g.y, g.z)
    frame.castShadow = false
    frame.receiveShadow = false
    const mesh: T.Mesh = frame
    mesh.material = ready
    root.add(mesh)
    // Three paired chevrons on the approach; their rhythm points through the opening.
    const paint = new Sculpt()
    for (let row = 0; row < 3; row++)
      for (const side of [-1, 1]) {
        const z = -2.4 - row * 1.55
        const height = (dz: number) => elevationAt(g.z + dz) - g.y + 0.09
        const center: V = [0, height(z + 0.42), z + 0.42]
        paint.rod(
          center,
          [side * 0.61, height(z - 0.13), z - 0.13],
          0.085,
          light,
        )
      }
    const chevrons = paint.mesh()
    chevrons.position.copy(frame.position)
    chevrons.castShadow = false
    root.add(chevrons)
    return { mesh, chevrons, g }
  })
  let flashedAt = -10,
    lastGate = -1
  return (p: Player, t: number) => {
    const result = p.wildline
    if ((result?.lastGate ?? -1) !== lastGate) {
      lastGate = result?.lastGate ?? -1
      flashedAt = t
    }
    const age = t - flashedAt
    for (const { g, mesh, chevrons } of gates) {
      mesh.visible = g.z > p.z - 24 && g.z < p.z + 145
      chevrons.visible = mesh.visible && g.index === lastGate + 1
      if (!mesh.visible) continue
      const flashing = g.index === lastGate && age >= 0 && age < 0.6
      mesh.material = flashing
        ? result.verdict === 'hit'
          ? hit
          : missed
        : g.index <= lastGate
          ? closed
          : ready
      mesh.scale.setScalar(
        flashing && result.verdict === 'hit'
          ? 1 + 0.17 * Math.sin((Math.PI * age) / 0.6)
          : 1,
      )
    }
  }
}
