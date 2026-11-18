import * as T from 'three'

const steps = 10
const paint = new T.MeshBasicMaterial({
  vertexColors: true,
  side: T.DoubleSide,
  depthWrite: false,
})
const colors = ['#fff2aa', '#ffce4c', '#ff933c']
const bands = [-0.74, -0.54, 0.54, 0.74]

/** A pair of pinstriped ribbons records the racer's actual line through the last third of a second. */
export class SpeedTrail {
  readonly mesh: T.Mesh
  private centers = new Float32Array(steps * 3)
  private normals = new Float32Array(steps * 2)
  private points = new T.Float32BufferAttribute(
    new Float32Array(steps * bands.length * 2 * 3),
    3,
  )
  private sampleTime = -1
  private head = 0
  private count = 0
  constructor() {
    const geometry = new T.BufferGeometry()
    this.points.setUsage(T.DynamicDrawUsage)
    const indices: number[] = [],
      tones: number[] = [],
      shade = new T.Color()
    for (let s = 0; s < steps; s++)
      for (let b = 0; b < bands.length; b++) {
        shade.set(colors[s < 3 && b % 3 === 0 ? 0 : s < 7 ? 1 : 2])
        tones.push(shade.r, shade.g, shade.b, shade.r, shade.g, shade.b)
        if (s < steps - 1) {
          const i = (s * bands.length + b) * 2,
            j = i + bands.length * 2
          indices.push(i, j, i + 1, i + 1, j, j + 1)
        }
      }
    geometry.setAttribute('position', this.points)
    geometry.setAttribute('color', new T.Float32BufferAttribute(tones, 3))
    geometry.setIndex(indices)
    this.mesh = new T.Mesh(geometry, paint)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
  }
  update(
    pos: T.Vector3,
    yaw: number,
    remaining: number,
    t: number,
    groundOffset: number,
  ) {
    if (remaining <= 0) {
      this.count = 0
      this.sampleTime = -1
      this.mesh.visible = false
      return
    }
    if (t - this.sampleTime > 0.031) {
      this.head = (this.head + 1) % steps
      const alongX = Math.sin(yaw),
        alongZ = Math.cos(yaw)
      this.centers[this.head * 3] = pos.x - alongX * 0.46
      this.centers[this.head * 3 + 1] = pos.y + groundOffset
      this.centers[this.head * 3 + 2] = pos.z - alongZ * 0.46
      this.normals[this.head * 2] = alongZ
      this.normals[this.head * 2 + 1] = -alongX
      this.count = Math.min(steps, this.count + 1)
      this.sampleTime = t
    }
    this.mesh.visible = this.count > 1
    const fade = Math.min(1, remaining * 7)
    for (let s = 0; s < this.count; s++) {
      const k = (this.head - s + steps) % steps,
        age = s / (steps - 1)
      for (let b = 0; b < bands.length; b++) {
        const line = bands[b],
          lateral = line * (1 + age * 0.65)
        const x = this.centers[k * 3] + this.normals[k * 2] * lateral
        const z = this.centers[k * 3 + 2] + this.normals[k * 2 + 1] * lateral
        const y =
          this.centers[k * 3 + 1] +
          age * 0.24 +
          Math.sin(t * 15 - age * 6 + line * 4) * 0.07
        const width = (b === 0 || b === 3 ? 0.13 : 0.063) * (1 - age) * fade
        const i = (s * bands.length + b) * 2
        this.points.setXYZ(i, x, y - width, z)
        this.points.setXYZ(i + 1, x, y + width, z)
      }
    }
    this.points.needsUpdate = true
    this.mesh.geometry.setDrawRange(
      0,
      Math.max(0, this.count - 1) * bands.length * 6,
    )
  }
}
