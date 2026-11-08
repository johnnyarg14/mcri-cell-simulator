import { FENCE, type FenceOpening } from '../config/cell.config';

export type Post = { x: number; z: number };
export type Panel = { cx: number; cz: number; len: number; axis: 'x' | 'z'; y0: number; y1: number; kind: 'mesh' | 'door' };

/** generează stâlpii și panourile gardului din config, cu goluri (tuneluri, uși, treceri paleți) */
export function buildFence(): { posts: Post[]; panels: Panel[] } {
  const posts: Post[] = [];
  const panels: Panel[] = [];
  const F = FENCE;
  const sides: { side: FenceOpening['side']; a: number; b: number; fixed: number; axis: 'x' | 'z' }[] = [
    { side: 'north', a: F.x0, b: F.x1, fixed: F.z0, axis: 'x' },
    { side: 'south', a: F.x0, b: F.x1, fixed: F.z1, axis: 'x' },
    { side: 'west', a: F.z0, b: F.z1, fixed: F.x0, axis: 'z' },
    { side: 'east', a: F.z0, b: F.z1, fixed: F.x1, axis: 'z' },
  ];
  for (const s of sides) {
    const L = s.b - s.a;
    const n = Math.ceil(L / F.postPitch - 1e-6);
    const openings = F.openings.filter((o) => o.side === s.side).map((o) => ({ ...o, o0: o.center - o.width / 2, o1: o.center + o.width / 2 }));
    const bounds: number[] = [];
    for (let k = 0; k <= n; k++) bounds.push(Math.min(s.b, s.a + k * F.postPitch));
    const inGate = (u: number) => openings.some((o) => o.kind === 'gate' && u > o.o0 + 1 && u < o.o1 - 1);
    for (const u of bounds) {
      if (inGate(u)) continue;
      posts.push(s.axis === 'x' ? { x: u, z: s.fixed } : { x: s.fixed, z: u });
    }
    // stâlpi la marginile golurilor
    for (const o of openings) for (const u of [o.o0, o.o1]) if (u > s.a && u < s.b) posts.push(s.axis === 'x' ? { x: u, z: s.fixed } : { x: s.fixed, z: u });

    const pushPanel = (u0: number, u1: number, y0: number, y1: number, kind: Panel['kind'] = 'mesh') => {
      if (u1 - u0 < 20) return;
      const c = (u0 + u1) / 2;
      panels.push({ cx: s.axis === 'x' ? c : s.fixed, cz: s.axis === 'x' ? s.fixed : c, len: u1 - u0, axis: s.axis, y0, y1, kind });
    };
    for (let k = 0; k < n; k++) {
      const b0 = bounds[k];
      const b1 = bounds[k + 1];
      // împarte golul [b0,b1] după deschideri
      let cursor = b0;
      const segs: { u0: number; u1: number; o: (typeof openings)[number] | null }[] = [];
      for (const o of openings.filter((o) => o.o1 > b0 && o.o0 < b1).sort((p, q) => p.o0 - q.o0)) {
        const o0 = Math.max(b0, o.o0);
        const o1 = Math.min(b1, o.o1);
        if (o0 > cursor) segs.push({ u0: cursor, u1: o0, o: null });
        segs.push({ u0: o0, u1: o1, o });
        cursor = o1;
      }
      if (cursor < b1) segs.push({ u0: cursor, u1: b1, o: null });
      for (const sg of segs) {
        if (!sg.o) pushPanel(sg.u0, sg.u1, F.panelBottomGap, F.panelHeight);
        else if (sg.o.kind === 'tunnel') pushPanel(sg.u0, sg.u1, sg.o.height, F.panelHeight);
        else if (sg.o.kind === 'door') {
          pushPanel(sg.u0, sg.u1, F.panelBottomGap, sg.o.height, 'door');
          pushPanel(sg.u0, sg.u1, sg.o.height, F.panelHeight);
        }
        // 'gate': fără panou
      }
    }
  }
  return { posts, panels };
}
