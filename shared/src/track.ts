// Distances are in metres. The course runs toward positive Z.
export const START_Z = 0;
export const FINISH_Z = 1472;
export const ZONES = [
  { name: 'Starting Stampede', start: -32, end: 216 },
  { name: 'Banana Boulevard', start: 216, end: 456 },
  { name: 'Suspicious Bridge', start: 456, end: 664 },
  { name: 'Mud Madness', start: 664, end: 920 },
  { name: 'Cannonball Hill', start: 920, end: 1200 },
  { name: 'Final Chaos', start: 1200, end: FINISH_Z + 40 },
] as const;
export const CHECKPOINTS = [...ZONES.slice(1).map(zone => zone.start), FINISH_Z];
type Surface = 'dirt' | 'bridge' | 'mud' | 'rock' | 'grass';
export type RoadPatch = {
  x: number; y: number; z: number; width: number; length: number;
  tilt: number; zone: number; surface: Surface;
};

export function zoneAt(z: number) {
  const index = ZONES.findIndex(zone => z < zone.end);
  return index === -1 ? ZONES.length - 1 : index;
}

export function centerAt(z: number) {
  return 11 * Math.sin(z / 86) + 4 * Math.sin(z / 38);
}

const profile = [
  [-32, 0], [48, 0], [104, 4], [160, 1], [216, 1], [300, 5], [408, 3],
  [456, 6], [560, 6], [664, 6], [712, 2], [920, 2], [1016, 19], [1144, -2],
  [1184, 0], [1200, 1], [1368, 1], [1416, 1], [1432, 4], [1448, 1], [1512, 1],
] as const;

export function elevationAt(z: number) {
  for (let i = 1; i < profile.length; i++) {
    const [z1, y1] = profile[i];
    if (z <= z1) {
      const [z0, y0] = profile[i - 1];
      return y0 + (y1 - y0) * Math.max(0, (z - z0) / (z1 - z0));
    }
  }
  return profile[profile.length - 1][1];
}

export function halfWidthAt(z: number) {
  return [13, 14, 5.6, 13, 12, 14][zoneAt(z)];
}

export const ROAD: RoadPatch[] = [];
function patch(z: number, x: number, width: number, y0: number, y1: number, surface: Surface) {
  const dz = 8;
  ROAD.push({ z, x, y: (y0 + y1) / 2, width, length: Math.hypot(dz, y1 - y0),
    tilt: -Math.atan2(y1 - y0, dz), zone: zoneAt(z), surface });
}

for (let start = -32; start < FINISH_Z + 40; start += 8) {
  const z = start + 4;
  const x = centerAt(z);
  const zone = zoneAt(z);
  const y0 = elevationAt(start);
  const y1 = elevationAt(start + 8);
  // Split lanes around banana islands. A narrowing divider leaves both approaches open.
  const divider = Math.max(0,
    Math.min(3.8, (z - 264) / 7, (392 - z) / 7),
    Math.min(3, (z - 1280) / 5, (1336 - z) / 5));
  if (divider > 0) {
    const laneWidth = halfWidthAt(z) - divider;
    for (const side of [-1, 1]) patch(z, x + side * (divider + laneWidth / 2), laneWidth, y0, y1, 'dirt');
  } else {
    const surface = (['dirt', 'dirt', 'bridge', 'mud', 'rock', 'dirt'] as const)[zone];
    patch(z, x, halfWidthAt(z) * 2, y0, y1, surface);
  }
  // A wider net of mossy ledges returns fallen racers to the bridge exit.
  if (zone === 2) {
    const drop = (s: number) => Math.min(3.3, Math.max(0, (s - 456) / 6), Math.max(0, (664 - s) / 8));
    patch(z, x, 25, y0 - drop(start) - 0.09, y1 - drop(start + 8) - 0.09, 'grass');
  }
  // Optional launch lips on the outside of Cannonball Hill. The inside lane stays level.
  if (zone === 4 && start >= 1064 && start < 1080) {
    patch(z, x - 7.5, 6.4, y0 + (start - 1064) * 0.18 + 0.06,
      y1 + (start + 8 - 1064) * 0.18 + 0.06, 'rock');
  }
  // Dry, narrow mud bypasses give racers a quicker route with less room to turn.
  if (zone === 3 && z >= 720 && z < 872) {
    patch(z, x - 10.4, 4.4, y0 + 0.07, y1 + 0.07, 'grass');
  }
}

export type HazardKind = 'gate' | 'log' | 'boulder' | 'spinner' | 'peel' | 'banana';
export type Hazard = {
  id: string; kind: HazardKind; z: number; lane: number; width: number; height: number;
  depth: number; amplitude: number; rate: number; phase: number;
};
export type Pose = { x: number; y: number; z: number; yaw: number };
export const HAZARDS: Hazard[] = [];

function hazard(kind: HazardKind, z: number, lane: number, width: number, height: number,
  depth: number, amplitude = 0, rate = 0, phase = 0) {
  HAZARDS.push({ id: kind + '-' + z, kind, z, lane, width, height, depth, amplitude, rate, phase });
}
hazard('gate', 92, 0, 4.5, 1.45, 1.8, 5, 0.7);
hazard('gate', 178, 0, 6, 1.65, 1.8, 5.8, 0.83, 2);
for (const [z, lane] of [[236, -6], [266, 8], [304, -8], [348, 9], [396, -8], [430, 4]]) {
  hazard('banana', z, lane, 1.35, 1.15, 1.35);
  hazard('peel', z + 12, -lane, 1.7, 0.35, 1.7);
}
hazard('gate', 370, 7.5, 3, 1.3, 1.5, 2.5, 0.9);
hazard('log', 732, 3, 6.4, 1.35, 1.45, 4.7, 0.62);
hazard('log', 814, 0, 7, 1.45, 1.6, 4.4, 0.75, 1);
hazard('log', 883, -2, 5, 1.4, 1.5, 5.8, 0.85, 2);
hazard('boulder', 1048, -6, 3.6, 3.6, 3.6, 20, 0.55);
hazard('boulder', 1104, 4, 4, 4, 4, 21, 0.51, 1.7);
hazard('boulder', 1152, -2, 3.4, 3.4, 3.4, 12, 0.71, 2);
hazard('spinner', 1256, 2, 10.5, 0.72, 1, 0, 1.7);
hazard('spinner', 1344, -4, 11.5, 0.8, 1, 0, -1.8, 1);

export function hazardPose(h: Hazard, t: number): Pose {
  const wave = Math.sin(t * h.rate + h.phase);
  const z = h.z + (h.kind === 'boulder' ? wave * h.amplitude : 0);
  const x = centerAt(z) + h.lane + (h.kind === 'boulder' ? 1.5 * wave : wave * h.amplitude);
  let y = elevationAt(z) + h.height / 2;
  if (h.kind === 'spinner') y += 0.35;
  if (h.kind === 'banana') y += 0.3;
  return { x, y, z, yaw: h.kind === 'spinner' ? t * h.rate + h.phase : 0 };
}

// Rain moves with the field; the server sends its chosen center with the event.
export function rainDrop(index: number, centerZ: number, age: number) {
  const row = Math.floor(index / 3);
  const z = centerZ + 8 + row * 9 + 2 * Math.sin(index * 3.77);
  const x = centerAt(z) + (index % 3 - 1) * 6 + 2.6 * Math.sin(index * 8.12);
  const flight = Math.max(0, 1 - Math.max(0, age - index * 0.065));
  return { x, z, y: elevationAt(z) + 0.18 + 13 * flight * flight, landed: age >= 1 + index * 0.065 };
}

/** Rope deck deflection under nearby heavyweight racers, shared with the renderer. */
export function bridgeSag(z: number, loads: ReadonlyArray<{ x: number; y: number; z: number; animal: string }>) {
  const span = Math.max(0, Math.min(1, (z - 456) / 15, (664 - z) / 15));
  let sag = 0;
  for (const racer of loads) {
    const distance = Math.abs(z - racer.z);
    if ((racer.animal === 'elephant' || racer.animal === 'gorilla') && distance < 18 &&
        Math.abs(racer.x - centerAt(racer.z)) < 6 && Math.abs(racer.y - elevationAt(racer.z)) < 1.8) {
      sag = Math.max(sag, (1 - distance / 18) * (racer.animal === 'elephant' ? 0.4 : 0.25));
    }
  }
  return sag * span;
}
