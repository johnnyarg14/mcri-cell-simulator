import { BUCKET_LINE, PALLET_LINE, ROBOTS, SAFETY, STATIONS, FENCE } from '../config/cell.config';
import type { TreeFolder } from '../store/useSimStore';

export type TreeNode = { id: string; name: string; children?: TreeNode[]; kind: string };

/** arborele de obiecte (Object Tree) generat din configurație */
export function buildObjectTree(): Record<TreeFolder, TreeNode[]> {
  const robots: TreeNode[] = ROBOTS.map((r) => ({
    id: r.id,
    name: r.name,
    kind: 'robot',
    children: [
      { id: r.tool.id, name: r.tool.name, kind: 'tool' },
      { id: r.id + '_MOUNT', name: r.mount.name, kind: 'mount' },
    ],
  }));
  const conveyors: TreeNode[] = [
    {
      id: 'PALLET_LINE',
      name: `Linie paleți CDLR (BF ${PALLET_LINE.bf}, TOR ${PALLET_LINE.tor})`,
      kind: 'palletLine',
      children: PALLET_LINE.zones.filter((z) => z.role !== 'wrapper').map((z) => ({ id: z.id, name: z.name, kind: 'cdlr' })),
    },
    ...BUCKET_LINE.conveyors.map((c) => ({
      id: c.id,
      name: c.name,
      kind: 'conveyor',
      children: [...c.stops.map((s) => ({ id: s.id, name: s.name, kind: 'stop' })), ...c.photocells.map((p) => ({ id: p.id, name: p.name, kind: 'photocell' }))],
    })),
  ];
  const S = STATIONS;
  const equipment: TreeNode[] = [
    { id: S.labeler.id, name: S.labeler.name, kind: 'labeler' },
    { id: S.vision.id, name: S.vision.name, kind: 'vision' },
    { id: S.pusher.id, name: S.pusher.name, kind: 'pusher' },
    { id: S.chute.id, name: S.chute.name, kind: 'chute' },
    { id: S.wrapper.id, name: S.wrapper.name, kind: 'wrapper' },
    { id: S.sheetMagazine.id, name: S.sheetMagazine.name, kind: 'magazine' },
    { id: S.sheetWasteBin.id, name: S.sheetWasteBin.name, kind: 'bin' },
  ];
  const products: TreeNode[] = [
    { id: 'PRODUCTS_PALLETS', name: 'Paleți', kind: 'group' },
    { id: 'PRODUCTS_BUCKETS', name: 'Găleți 5 gal (Ø305×370)', kind: 'group' },
    { id: 'PRODUCTS_SHEETS', name: 'Foi intermediare 1219×1016×4', kind: 'group' },
  ];
  const safety: TreeNode[] = [
    {
      id: 'FENCE',
      name: `Gard de protecție (stâlpi 2"×2" @ ${FENCE.postPitch}, h ${FENCE.panelHeight})`,
      kind: 'fence',
      children: FENCE.openings.map((o) => ({ id: 'OPEN_' + o.id, name: o.name, kind: 'opening' })),
    },
    ...SAFETY.lightCurtains.map((l) => ({ id: l.id, name: l.name, kind: 'lightCurtain' })),
    ...SAFETY.estops.map((e) => ({ id: e.id, name: e.name, kind: 'estop' })),
    ...SAFETY.floorMarkings.map((m) => ({ id: m.id, name: m.name, kind: 'marking' })),
  ];
  return { Roboți: robots, Conveioare: conveyors, Echipamente: equipment, Produse: products, Siguranță: safety };
}

/** caută un nod după id */
export function findNode(tree: Record<string, TreeNode[]>, id: string): TreeNode | null {
  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const f = walk(n.children);
        if (f) return f;
      }
    }
    return null;
  };
  for (const k of Object.keys(tree)) {
    const f = walk(tree[k]);
    if (f) return f;
  }
  return null;
}
