import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const box = new T.BoxGeometry()
export const ball = new T.SphereGeometry(1, 10, 7)
export const pebble = new T.IcosahedronGeometry(1, 0)
export const boulder = new T.IcosahedronGeometry(1, 1)
export const tube = new T.CylinderGeometry(1, 1, 1, 9)
export const cone = new T.ConeGeometry(1, 1, 9)
export const palette = new T.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.94,
})
type Triple = [number, number, number]
const transform = new T.Object3D()

/** Bake rigid parts into one vertex-coloured draw call per animated joint. */
export class Sculpt {
  private parts: T.BufferGeometry[] = []
  part(
    shape: T.BufferGeometry,
    tint: string,
    position: Triple,
    scale: Triple,
    rotation: Triple = [0, 0, 0],
  ) {
    const geometry = shape.index ? shape.toNonIndexed() : shape.clone()
    transform.position.set(...position)
    transform.scale.set(...scale)
    transform.rotation.set(...rotation)
    transform.updateMatrix()
    geometry.applyMatrix4(transform.matrix)
    geometry.deleteAttribute('uv')
    geometry.computeVertexNormals()
    const colour = new T.Color(tint)
    const count = geometry.getAttribute('position').count
    const colours = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colour.toArray(colours, i * 3)
    geometry.setAttribute('color', new T.BufferAttribute(colours, 3))
    this.parts.push(geometry)
    return this
  }
  rod(from: Triple, to: Triple, radius: number, tint: string, shape = tube) {
    const a = new T.Vector3(...from),
      b = new T.Vector3(...to)
    const delta = b.clone().sub(a)
    const rot = new T.Euler().setFromQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        delta.clone().normalize(),
      ),
    )
    return this.part(
      shape,
      tint,
      [a.x / 2 + b.x / 2, a.y / 2 + b.y / 2, a.z / 2 + b.z / 2],
      [radius, delta.length(), radius],
      [rot.x, rot.y, rot.z],
    )
  }
  mesh() {
    const geometry = mergeGeometries(this.parts, false)!
    this.parts.forEach((g) => g.dispose())
    this.parts = []
    const result = new T.Mesh(geometry, palette)
    result.castShadow = true
    result.receiveShadow = true
    return result
  }
}
export function seeded(initial: number) {
  let seed = initial >>> 0
  return () =>
    (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296
}
