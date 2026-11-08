import { useRef, useState } from 'react';
import { buildObjectTree } from '../scene/objects';
import { useModelStore, type RuntimeModel } from '../store/useModelStore';
import { useSimStore } from '../store/useSimStore';

/** lista id-urilor de obiecte care pot fi înlocuite cu un model glTF */
function replaceableIds(): { id: string; name: string }[] {
  const tree = buildObjectTree();
  const out: { id: string; name: string }[] = [];
  const walk = (nodes: { id: string; name: string; children?: unknown[] }[]) => {
    for (const n of nodes) {
      if (!n.id.startsWith('PRODUCTS_') && !n.id.startsWith('OPEN_') && !n.id.startsWith('MARK_') && n.id !== 'PALLET_LINE' && n.id !== 'FENCE') out.push({ id: n.id, name: n.name });
      if (n.children) walk(n.children as { id: string; name: string; children?: unknown[] }[]);
    }
  };
  walk([...tree.Roboți, ...tree.Conveioare, ...tree.Echipamente, ...tree.Siguranță]);
  return out;
}

export function ModelEditor({ m }: { m: RuntimeModel }) {
  const { update, remove } = useModelStore();
  const ids = replaceableIds();
  const num = (v: number, k: 'position' | 'rotation', i: number) => {
    const arr = [...m[k]] as [number, number, number];
    arr[i] = v;
    update(m.id, { [k]: arr });
  };
  return (
    <div className="px-2 py-1 border-b border-ps-border/40 space-y-1">
      <div className="flex items-center gap-1">
        <input className="ps-input flex-1" value={m.name} onChange={(e) => update(m.id, { name: e.target.value })} />
        <button className="ps-btn" title={m.visible ? 'Ascunde' : 'Afișează'} onClick={() => update(m.id, { visible: !m.visible })}>
          {m.visible ? '👁' : '◌'}
        </button>
        <button className="ps-btn" title="Șterge modelul" onClick={() => remove(m.id)}>
          ✕
        </button>
      </div>
      <div className="text-[10px] text-ps-muted font-mono">
        {m.fileName} · {(m.size / 1024).toFixed(0)} kB
      </div>
      <label className="flex items-center gap-1">
        <span className="text-ps-muted w-16">Înlocuiește</span>
        <select className="ps-input" value={m.objectId} onChange={(e) => update(m.id, { objectId: e.target.value })}>
          <option value="CUSTOM">— plasare liberă (obiect nou) —</option>
          {ids.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id} · {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <span className="text-ps-muted w-16">Scară</span>
        <input className="ps-input w-20" type="number" step={0.001} value={m.scale} onChange={(e) => update(m.id, { scale: Number(e.target.value) || 1 })} />
        <button className="ps-btn" onClick={() => update(m.id, { scale: 1 })}>
          mm
        </button>
        <button className="ps-btn" onClick={() => update(m.id, { scale: 1000 })}>
          m
        </button>
        <button className="ps-btn" onClick={() => update(m.id, { scale: 25.4 })}>
          inch
        </button>
      </label>
      <div className="flex items-center gap-1">
        <span className="text-ps-muted w-16">Poziție</span>
        {(['X', 'Y', 'Z'] as const).map((a, i) => (
          <input key={a} className="ps-input" type="number" step={10} title={a + ' (mm)'} value={m.position[i]} onChange={(e) => num(Number(e.target.value), 'position', i)} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-ps-muted w-16">Rotație</span>
        {(['X', 'Y', 'Z'] as const).map((a, i) => (
          <input key={a} className="ps-input" type="number" step={15} title={a + ' (°)'} value={m.rotation[i]} onChange={(e) => num(Number(e.target.value), 'rotation', i)} />
        ))}
        <button className="ps-btn whitespace-nowrap" title="Model cu Z în sus (CAD) → Y în sus" onClick={() => update(m.id, { rotation: [-90, 0, 0] })}>
          Z↑
        </button>
      </div>
    </div>
  );
}

export function ModelsPanel() {
  const models = useModelStore((s) => s.models);
  const add = useModelStore((s) => s.add);
  const manifest = useModelStore((s) => s.manifest);
  const setStatus = useSimStore((s) => s.setStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('CUSTOM');
  const ids = replaceableIds();

  const onFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!/\.(glb|gltf)$/i.test(f.name)) {
        setStatus(`${f.name}: acceptă doar .glb / .gltf (convertește STEP → glTF, vezi README)`);
        continue;
      }
      await add(f, target);
      setStatus(`Model importat: ${f.name}${target === 'CUSTOM' ? ' (plasare liberă la origine)' : ` → ${target}`}`);
    }
  };

  return (
    <div className="text-xs">
      <div className="ps-title">Modele CAD (glTF / GLB)</div>
      <div className="px-2 py-1 text-[10px] text-ps-muted">
        Modelele importate aici sunt salvate în browser (IndexedDB) și înlocuiesc primitiva obiectului ales. Pentru o configurație permanentă copiază fișierele în <code>public/models/</code> și exportă manifestul.
      </div>
      <div className="px-2 py-1 space-y-1">
        <label className="flex items-center gap-1">
          <span className="text-ps-muted w-16">Atribuie la</span>
          <select className="ps-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="CUSTOM">— plasare liberă (obiect nou) —</option>
            {ids.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="border border-dashed border-ps-border rounded p-3 text-center text-ps-muted hover:border-ps-accent cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          Trage fișiere .glb aici sau click pentru a alege
          <br />
          <span className="text-[10px]">(se pot trage și direct peste viewport-ul 3D)</span>
        </div>
        <input ref={fileRef} type="file" accept=".glb,.gltf" multiple className="hidden" onChange={(e) => e.target.files && onFiles(e.target.files)} />
      </div>
      <div className="ps-title flex items-center justify-between">
        <span>Modele importate ({models.length})</span>
        <button
          className="ps-btn normal-case tracking-normal"
          onClick={() => {
            const blob = new Blob([JSON.stringify(manifest(), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'manifest.json';
            a.click();
          }}
          disabled={models.length === 0}
        >
          ⤓ manifest.json
        </button>
      </div>
      {models.length === 0 && <div className="px-2 py-2 text-ps-muted">Niciun model importat.</div>}
      {models.map((m) => (
        <ModelEditor key={m.id} m={m} />
      ))}
      <div className="ps-title">STEP → glTF (pe scurt)</div>
      <div className="px-2 py-1 text-[10px] text-ps-muted space-y-1">
        <div>• FreeCAD 0.21+: Import STEP → Export glTF (.glb). Unități mm → scară 1.</div>
        <div>• CadQuery: <code>cq.exporters.export(shape, "x.glb")</code>.</div>
        <div>• Blender: Import STL/OBJ → Export glTF 2.0 (bifează „+Y up”).</div>
        <div>• Modele cu Z în sus: butonul „Z↑” setează rotația −90° pe X.</div>
      </div>
    </div>
  );
}
