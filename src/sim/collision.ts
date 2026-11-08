import { Matrix4, Vector3 } from 'three';
import { BUCKET_LINE, FENCE, PALLET_LINE, STATIONS, ROBOTS, type RobotConfig } from '../config/cell.config';

export interface AABB {
  id: string;
  name: string;
  min: [number, number, number];
  max: [number, number, number];
}

const box = (id: string, name: string, cx: number, cy: number, cz: number, w: number, h: number, d: number): AABB => ({
  id,
  name,
  min: [cx - w / 2, cy - h / 2, cz - d / 2],
  max: [cx + w / 2, cy + h / 2, cz + d / 2],
});

/** corpuri statice folosite la detecția de coliziuni gripper ↔ scenă */
export function buildStaticBodies(): AABB[] {
  const b: AABB[] = [];
  const F = FENCE;
  const fh = F.panelHeight;
  const t = F.postSize;
  b.push(box('FENCE_N', 'Gard – latura nord', (F.x0 + F.x1) / 2, fh / 2, F.z0, F.x1 - F.x0, fh, t));
  b.push(box('FENCE_S', 'Gard – latura sud', (F.x0 + F.x1) / 2, fh / 2, F.z1, F.x1 - F.x0, fh, t));
  b.push(box('FENCE_W', 'Gard – latura vest', F.x0, fh / 2, (F.z0 + F.z1) / 2, t, fh, F.z1 - F.z0));
  b.push(box('FENCE_E', 'Gard – latura est', F.x1, fh / 2, (F.z0 + F.z1) / 2, t, fh, F.z1 - F.z0));
  // ghidaje laterale conveioare găleți (segmente drepte)
  for (const c of BUCKET_LINE.conveyors) {
    for (let i = 1; i < c.path.length; i++) {
      const a = c.path[i - 1];
      const p = c.path[i];
      const dx = p.x - a.x;
      const dz = p.z - a.z;
      const L = Math.hypot(dx, dz);
      if (L < 200) continue; // ignoră segmentele mici ale curbei
      const nx = -dz / L;
      const nz = dx / L;
      const off = BUCKET_LINE.guideRailOffset;
      const y = BUCKET_LINE.tor + BUCKET_LINE.guideRailH / 2;
      for (const sgn of [-1, 1]) {
        const cx = (a.x + p.x) / 2 + nx * off * sgn;
        const cz = (a.z + p.z) / 2 + nz * off * sgn;
        const w = Math.abs(dx) > Math.abs(dz) ? L : 40;
        const d = Math.abs(dx) > Math.abs(dz) ? 40 : L;
        b.push(box(`${c.id}_RAIL_${i}_${sgn > 0 ? 'R' : 'L'}`, `Ghidaj lateral ${c.id.replace('CONV_', '')}`, cx, y, cz, w, BUCKET_LINE.guideRailH, d));
      }
    }
  }
  // cadre CDLR
  const Z = PALLET_LINE.zones;
  const z0 = Z[0].z0;
  const z1 = Z[Z.length - 1].z1;
  for (const sgn of [-1, 1]) {
    b.push(
      box(
        `CDLR_FRAME_${sgn > 0 ? 'E' : 'W'}`,
        'Cadru CDLR paleți',
        PALLET_LINE.x + sgn * (PALLET_LINE.bf / 2 + 40),
        PALLET_LINE.tor - PALLET_LINE.frameH / 2 + 20,
        (z0 + z1) / 2,
        80,
        PALLET_LINE.frameH,
        z1 - z0,
      ),
    );
  }
  // stații
  const L = STATIONS.labeler;
  b.push(box(L.id, L.name, L.pos.x, L.standH + L.box.h / 2, L.pos.z + L.offsetZ, L.box.w, L.box.h, L.box.d));
  const V = STATIONS.vision;
  b.push(box(V.id, V.name, V.pos.x, V.archH, V.pos.z, V.length, 200, V.width));
  const M = STATIONS.sheetMagazine;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      b.push(
        box(
          `${M.id}_POST_${sx}_${sz}`,
          'Montant magazie foi',
          M.center.x + sx * (M.footprint.x / 2 + M.guidePostSize / 2),
          M.platformH + M.guidePostH / 2,
          M.center.z + sz * (M.footprint.z / 2 + M.guidePostSize / 2),
          M.guidePostSize,
          M.guidePostH,
          M.guidePostSize,
        ),
      );
  const B = STATIONS.sheetWasteBin;
  b.push(box(B.id, B.name, B.center.x, B.size.h / 2, B.center.z, B.size.w, B.size.h, B.size.d));
  const Wp = STATIONS.wrapper;
  b.push(box(Wp.id + '_MAST', 'Catarg infoliator', Wp.mastPos.x, Wp.mast.h / 2, Wp.mastPos.z, Wp.mast.w, Wp.mast.h, Wp.mast.d));
  for (const r of ROBOTS) {
    b.push(box(r.id + '_MOUNT', r.mount.name, r.base.x, r.mount.h / 2, r.base.z, r.mount.w, r.mount.h, r.mount.d));
  }
  return b;
}

const corners = new Array(8).fill(0).map(() => new Vector3());

/** AABB al sculei (cadrul flanșei → cutia sculei până la TCP) */
export function toolAABB(cfg: RobotConfig, flange: Matrix4, out: { min: number[]; max: number[] }) {
  const t = cfg.tool;
  const hx = t.plateL / 2;
  const hy = t.plateW / 2;
  let k = 0;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const z of [0, t.tcpOffset]) corners[k++].set(sx * hx, sy * hy, z).applyMatrix4(flange);
  out.min[0] = out.min[1] = out.min[2] = Infinity;
  out.max[0] = out.max[1] = out.max[2] = -Infinity;
  for (const c of corners) {
    out.min[0] = Math.min(out.min[0], c.x);
    out.min[1] = Math.min(out.min[1], c.y);
    out.min[2] = Math.min(out.min[2], c.z);
    out.max[0] = Math.max(out.max[0], c.x);
    out.max[1] = Math.max(out.max[1], c.y);
    out.max[2] = Math.max(out.max[2], c.z);
  }
}

export function aabbOverlap(a: { min: number[]; max: number[] }, b: AABB): boolean {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] && a.min[1] <= b.max[1] && a.max[1] >= b.min[1] && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}
