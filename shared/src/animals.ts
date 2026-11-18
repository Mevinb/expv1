import type { Animal } from './protocol.js'

export interface AnimalSpec {
  name: string; role: string; passive: string; special: string; weakness: string
  speed: number; handling: number; chaos: number
  topSpeed: number; acceleration: number; mass: number; cooldown: number; color: string
}
export const ANIMALS: Record<Animal, AnimalSpec> = {
  elephant: { name: 'Elephant', role: 'The Gas Cannon', passive: 'Heavy Body', special: 'Fart Rocket', weakness: 'A wall hit during a boost can stun you.', speed: 3, handling: 3, chaos: 5, topSpeed: 8.2, acceleration: 13, mass: 3.2, cooldown: 12, color: '#ae9de2' },
  penguin: { name: 'Penguin', role: 'The Belly Missile', passive: 'Slippery Body', special: 'Belly Slide', weakness: 'Wide turns at speed. Mud slows your slide.', speed: 5, handling: 2, chaos: 4, topSpeed: 9.3, acceleration: 19, mass: 1, cooldown: 8, color: '#6acbd6' },
  gorilla: { name: 'Gorilla', role: 'The Uber Driver', passive: 'Strong Arms', special: 'Grab & Throw', weakness: 'Close the gap to grab a rival with F.', speed: 3, handling: 4, chaos: 5, topSpeed: 8.8, acceleration: 17, mass: 2.5, cooldown: 10, color: '#ef967a' },
  turtle: { name: 'Turtle', role: 'The Shell Rocket', passive: 'Armored Shell', special: 'Shell Roll', weakness: 'Slow starts and limited steering while rolling.', speed: 3, handling: 3, chaos: 4, topSpeed: 8.4, acceleration: 14, mass: 1.8, cooldown: 9, color: '#b3cf64' },
}
export const isAnimal = (value: unknown): value is Animal => typeof value === 'string' && Object.hasOwn(ANIMALS, value)
