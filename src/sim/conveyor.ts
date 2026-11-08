import type { Vec2, BucketConveyor } from '../config/cell.config';

/** geometrie 1D a unui conveior definit prin polilinie */
export class ConveyorPath {
  readonly pts: Vec2[];
  readonly cum: number[]; // lungimi cumulate
  readonly length: number;
  constructor(pts: Vec2[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dz = pts[i].z - pts[i - 1].z;
      this.cum.push(this.cum[i - 1] + Math.hypot(dx, dz));
    }
    this.length = this.cum[this.cum.length - 1];
  }
  /** poziție în plan și direcție (unghi yaw în grade) la abscisa s */
  at(s: number): { x: number; z: number; yaw: number } {
    const n = this.pts.length;
    if (n === 1) return { x: this.pts[0].x, z: this.pts[0].z, yaw: 0 };
    let sc = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < n - 1 && this.cum[i] < sc) i++;
    const a = this.pts[i - 1];
    const b = this.pts[i];
    const segL = this.cum[i] - this.cum[i - 1] || 1;
    const u = (sc - this.cum[i - 1]) / segL;
    const x = a.x + (b.x - a.x) * u;
    const z = a.z + (b.z - a.z) * u;
    const yaw = (Math.atan2(-(b.z - a.z), b.x - a.x) * 180) / Math.PI;
    return { x, z, yaw };
  }
  /** proiecția unui punct pe polilinie → abscisa s */
  project(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const L2 = vx * vx + vz * vz || 1;
      let u = ((x - a.x) * vx + (z - a.z) * vz) / L2;
      u = Math.max(0, Math.min(1, u));
      const px = a.x + vx * u;
      const pz = a.z + vz * u;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        best = this.cum[i - 1] + Math.sqrt(L2) * u;
      }
    }
    return best;
  }
}

export function buildPaths(convs: BucketConveyor[]): Record<string, ConveyorPath> {
  const out: Record<string, ConveyorPath> = {};
  for (const c of convs) out[c.id] = new ConveyorPath(c.path);
  return out;
}
