import type { Animal } from '../../../shared/src/protocol.js'

// Transparent portraits baked from the same articulated meshes used on the course.
export function animalPortrait(animal: Animal) {
  return import.meta.env.BASE_URL + 'racers/' + animal + '.png'
}
