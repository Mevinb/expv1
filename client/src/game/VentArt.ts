import * as T from 'three'
import { STEAM_VENTS, ventState } from '../../../shared/src/vents.js'
import { elevationAt } from '../../../shared/src/track.js'
import { box, pebble, Sculpt } from './Art.js'

const disc = new T.CylinderGeometry(1, 1, 1, 14)
const pool = new T.CylinderGeometry(0.9, 1, 1, 14)
const plumePaint = new T.MeshBasicMaterial({ color: 'white' })
const transform = new T.Object3D()
const phaseColor = new T.Color()
const water = new T.Color('#39c9ca')
const amber = new T.Color('#ff9940')
const steam = new T.Color('#d1fff2')

/** The basin fits the exact launch radius. Its glow, bubbles and jet share the physics clock. */
export function steamFields(parent: T.Group) {
  const fields = STEAM_VENTS.map((vent) => {
    const { x, y, z, radius } = vent
    const root = new T.Group()
    root.position.set(x, y + 0.08, z)
    root.rotation.x = -Math.atan2(elevationAt(z + 1) - elevationAt(z - 1), 2)
    parent.add(root)
    const s = new Sculpt()
    s.part(disc, '#594654', [0, 0.035, 0], [radius * 1.08, 0.15, radius * 1.08])
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14
      const sin = Math.sin(angle),
        cos = Math.cos(angle)
      s.part(
        pebble,
        i % 3 === 0 ? '#f1d689' : '#899d91',
        [sin * radius, 0.12, cos * radius],
        [0.38, 0.19 + (i % 3) * 0.06, 0.43],
        [0, angle, 0],
      )
      if (i % 2 === 0) {
        const xx = sin * radius * 1.07,
          zz = cos * radius * 1.07
        s.rod(
          [xx, 0.07, zz],
          [xx + sin * 0.39, 0.075, zz + cos * 0.37],
          0.052,
          '#806447',
        )
      }
    }
    // Parallel dashes and an upward arrow distinguish this choice from the gold timing arches.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        s.part(
          box,
          '#409a95',
          [side * 1.04, 0.05, -radius - 0.62 - i * 0.7],
          [0.27, 0.055, 0.42],
        )
      s.rod(
        [side * 0.72, 0.07, -radius - 1.55],
        [0, 0.07, -radius - 0.89],
        0.105,
        '#f5eeac',
      )
    }
    const rock = s.mesh()
    rock.castShadow = false
    root.add(rock)
    const basin = new T.Mesh(pool, new T.MeshBasicMaterial({ color: water }))
    basin.position.y = 0.13
    basin.scale.set(radius * 0.91, 0.09, radius * 0.91)
    root.add(basin)
    const puffs = new T.InstancedMesh(pebble, plumePaint, 18)
    puffs.instanceMatrix.setUsage(T.DynamicDrawUsage)
    puffs.frustumCulled = false
    for (let i = 0; i < 18; i++)
      puffs.setColorAt(
        i,
        new T.Color(
          i % 4 === 0 ? '#9ce1d7' : i % 3 === 0 ? '#dfefd8' : '#fff6df',
        ),
      )
    root.add(puffs)
    return { vent, root, basin, puffs }
  })
  return (elapsed: number, z: number) => {
    let calderaPulse = 0
    for (const { vent, root, basin, puffs } of fields) {
      const distance = Math.abs(z - vent.z)
      root.visible = vent.z > z - 26 && vent.z < z + 135
      const { stage, progress } = ventState(vent, elapsed)
      const erupting = stage === 'erupting',
        warning = stage === 'warning'
      const jet = erupting ? Math.min(1, progress * 10, (1 - progress) * 5) : 0
      if (vent.z > 920 && vent.z < 1200 && distance < 75)
        calderaPulse = Math.max(
          calderaPulse,
          jet * T.MathUtils.smoothstep(75 - distance, 0, 35),
        )
      if (!root.visible) continue
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * (warning ? 17 : 3))
      phaseColor.copy(water)
      if (warning) phaseColor.lerp(amber, 0.48 + 0.5 * pulse)
      if (erupting) phaseColor.lerp(steam, jet)
      basin.material.color.copy(phaseColor)
      puffs.count = erupting ? 18 : warning ? 10 : 4
      for (let i = 0; i < puffs.count; i++) {
        const age =
          (elapsed * (erupting ? 0.97 : warning ? 1.63 : 0.58) + i * 0.381966) %
          1
        const angle = i * 2.4 + age * 0.6
        const spread = erupting ? 0.3 + age * 1.03 : 1.1
        const height = erupting
          ? 0.17 + age * (0.65 + jet * 6.6)
          : 0.18 + Math.sin(age * Math.PI) * (warning ? 0.98 : 0.27)
        const scale = erupting
          ? (0.39 + age * 0.64) * Math.sin(Math.PI * age)
          : (0.09 + pulse * 0.1) * Math.sin(Math.PI * age)
        transform.position.set(
          Math.cos(angle) * spread,
          height,
          Math.sin(angle) * spread,
        )
        transform.rotation.set(age, i, 0)
        transform.scale.set(scale, scale * (erupting ? 1.37 : 1), scale)
        transform.updateMatrix()
        puffs.setMatrixAt(i, transform.matrix)
      }
      puffs.instanceMatrix.needsUpdate = true
    }
    return calderaPulse
  }
}
