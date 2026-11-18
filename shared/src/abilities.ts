/** Distances in metres, velocities in m/s, windows in seconds. Base stats live in animals.ts. */
export const ABILITIES = {
  elephant: {
    duration: 1.15, speed: 25, impulse: 12, lift: 0.9, blastRadius: 5,
    blastLift: 2.5, hitStun: 0.2, wallStun: 0.72, instinctBoost: 0.28,
  },
  penguin: {
    duration: 3.4, speed: 16, downhillGain: 4, mudMultiplier: 0.63,
    slickFriction: 0.035, turnSpeed: 1.35, instinctBoost: 0.28,
  },
  gorilla: {
    duration: 2, grabRange: 3.9, escapeDelay: 0.45, throwSpeed: 15,
    throwLift: 9, throwStun: 0.45, mantleSpeed: 5, mantleLift: 8.4, instinctSpeed: 1.18,
  },
  turtle: {
    duration: 3, speed: 17, downhillGain: 4, turnSpeed: 1.35, rollFriction: 0.035,
    armor: 0.68, wallStun: 0.22, hideSpeed: 0.8,
  },
} as const
