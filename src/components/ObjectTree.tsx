import { useMemo, useState } from 'react';
import { buildObjectTree, type TreeNode } from '../scene/objects';
import { useSimStore, type TreeFolder } from '../store/useSimStore';
import { engine } from '../sim/engine';
import { useModelStore } from '../store/useModelStore';

const ICONS: Record<string, string> = {
  robot: '🤖',
  tool: '🧲',
  mount: '▭',
  palletLine: '⫸',
  cdlr: '▬',
  conveyor: '⟶',
  stop: '⛔',
  photocell: '◉',
  labeler: '🏷',
  vision: '📷',
  pusher: '⇥',
  chute: '⤵',
  wrapper: '🌀',
  magazine: '▤',
  bin: '🗑',
  group: '▣',
  fence: '▦',
  opening: '▢',
  lightCurtain: '⫼',
  estop: '🔴',
  marking: '▭',
  product: '●',
  model: '◆',
};

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const selectedId = useSimStore((s) => s.selectedId);
  const hidden = useSimStore((s) => !!s.hidden[node.id]);
  const select = useSimStore((s) => s.select);
  const toggleHidden = useSimStore((s) => s.toggleHidden);
  const [open, setOpen] = useState(depth < 1);
  const sel = selectedId === node.id;
  return (
    <div>
      <div
        className={`flex items-center gap-1 pr-1 py-[2px] cursor-pointer hover:bg-white/5 ${sel ? 'bg-ps-accent/25 text-white' : ''} ${hidden ? 'opacity-50' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => select(node.id)}
      >
        <span
          className="w-3 text-ps-muted text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {node.children?.length ? (open ? '▾' : '▸') : ''}
        </span>
        <span className="w-4 text-center text-[11px]">{ICONS[node.kind] ?? '•'}</span>
        <span className="truncate flex-1" title={node.name}>
          {node.name}
        </span>
        <button
          className="text-[11px] text-ps-muted hover:text-white px-1"
          title={hidden ? 'Afișează' : 'Ascunde'}
          onClick={(e) => {
            e.stopPropagation();
            toggleHidden(node.id);
          }}
        >
          {hidden ? '◌' : '👁'}
        </button>
      </div>
      {open && node.children?.map((c) => <Node key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );
}

function Folder({ name, nodes, count }: { name: string; nodes: TreeNode[]; count?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1 bg-ps-panel2/60 border-y border-ps-border/60 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <span className="text-ps-muted text-[10px] w-3">{open ? '▾' : '▸'}</span>
        <span className="text-[11px]">📁</span>
        <span className="font-semibold">{name}</span>
        <span className="ml-auto text-ps-muted text-[10px]">{count ?? nodes.length}</span>
      </div>
      {open && nodes.map((n) => <Node key={n.id} node={n} depth={1} />)}
    </div>
  );
}

export function ObjectTree() {
  const tree = useMemo(() => buildObjectTree(), []);
  const version = useSimStore((s) => s.productsVersion);
  const products = useMemo(() => {
    void version;
    const list = [...engine.products.values()];
    const grp = (kind: string, label: string, id: string) => ({
      id,
      name: `${label} (${list.filter((p) => p.kind === kind).length})`,
      kind: 'group',
      children: list
        .filter((p) => p.kind === kind)
        .slice(0, 60)
        .map((p) => ({ id: p.id, name: `${label.split(' ')[0]} ${p.serial}${p.kind === 'bucket' && p.reject ? ' – REBUT' : ''}${p.kind === 'bucket' && p.labeled ? ' ✓' : ''}`, kind: 'product' })),
    });
    return [grp('pallet', 'Paleți', 'PRODUCTS_PALLETS'), grp('bucket', 'Găleți 5 gal', 'PRODUCTS_BUCKETS'), grp('sheet', 'Foi intermediare', 'PRODUCTS_SHEETS')];
  }, [version]);
  const allModels = useModelStore((s) => s.models);
  const customModels = useMemo(() => allModels.filter((m) => m.objectId === 'CUSTOM'), [allModels]);
  const equipment = useMemo(
    () => [...tree.Echipamente, ...(customModels.length ? [{ id: 'CUSTOM_MODELS', name: 'Modele CAD importate', kind: 'group', children: customModels.map((m) => ({ id: m.id, name: m.name, kind: 'model' })) }] : [])],
    [tree, customModels],
  );
  const layout = useSimStore((s) => s.layout);
  const folders: TreeFolder[] = ['Roboți', 'Conveioare', 'Echipamente', 'Produse', 'Siguranță'];
  if (layout === 'empty') {
    const byParent = (pid?: string): TreeNode[] => customModels.filter((m) => (m.parentId ?? undefined) === pid).map((m) => ({ id: m.id, name: m.name, kind: 'model', children: byParent(m.id) }));
    const roots = byParent(undefined).concat(customModels.filter((m) => m.parentId && !customModels.some((p) => p.id === m.parentId)).map((m) => ({ id: m.id, name: m.name, kind: 'model' })));
    return (
      <div className="w-[300px] shrink-0 flex flex-col bg-ps-panel border-r border-ps-border">
        <div className="ps-title">Object Tree – celulă goală</div>
        <div className="flex-1 overflow-auto text-xs">
          <Folder name="Modele CAD importate" nodes={roots} count={customModels.length} />
          {customModels.length === 0 && <div className="px-3 py-2 text-ps-muted">Niciun model. Trage fișiere .glb peste viewport.</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="w-[300px] shrink-0 flex flex-col bg-ps-panel border-r border-ps-border">
      <div className="ps-title">Object Tree</div>
      <div className="flex-1 overflow-auto text-xs">
        {folders.map((f) => (
          <Folder key={f} name={f} nodes={f === 'Produse' ? products : f === 'Echipamente' ? equipment : tree[f]} count={f === 'Produse' ? engine.products.size : undefined} />
        ))}
      </div>
    </div>
  );
}
