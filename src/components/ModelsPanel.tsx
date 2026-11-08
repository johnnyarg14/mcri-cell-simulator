import { useRef, useState } from 'react';
import { buildObjectTree } from '../scene/objects';
import { useModelStore, type RuntimeModel } from '../store/useModelStore';
import { useSimStore } from '../store/useSimStore';
import { exportProject, importProject } from '../utils/project';
import { ACCEPT_ATTR, convertToGLB, isConvertible } from '../utils/convert';

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
  const all = useModelStore((s) => s.models);
  const ids = replaceableIds();
  const isDescendant = (cand: string, of: string): boolean => {
    let cur = all.find((x) => x.id === cand);
    while (cur?.parentId) {
      if (cur.parentId === of) return true;
      cur = all.find((x) => x.id === cur!.parentId);
    }
    return false;
  };
  const parents = all.filter((x) => x.id !== m.id && x.objectId === 'CUSTOM' && !isDescendant(x.id, m.id));
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
        <button
          className="ps-btn"
          title="Descarcă fișierul .glb convertit (pentru public/models/)"
          onClick={() => {
            const b = useModelStore.getState().getBlob(m.id);
            if (!b) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = m.fileName;
            a.click();
          }}
        >
          ⤓
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
      {m.objectId === 'CUSTOM' && (
        <label className="flex items-center gap-1" title="Copilul se mișcă odată cu părintele (poziția/rotația sunt relative la părinte) – util pentru piese de robot">
          <span className="text-ps-muted w-16">Părinte</span>
          <select className="ps-input" value={m.parentId ?? ''} onChange={(e) => update(m.id, { parentId: e.target.value || undefined })}>
            <option value="">— niciunul (fix în celulă) —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-1">
        <span className="text-ps-muted w-16">Scară</span>
        <input className="ps-input !w-20" type="number" step={0.001} value={m.scale} onChange={(e) => update(m.id, { scale: Number(e.target.value) || 1 })} />
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
  const projRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('CUSTOM');
  const ids = replaceableIds();
  const layout = useSimStore((s) => s.layout);

  const [busy, setBusy] = useState<string | null>(null);
  const onFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!isConvertible(f.name)) {
        setStatus(`${f.name}: format neacceptat (acceptă ${ACCEPT_ATTR})`);
        continue;
      }
      try {
        setBusy(`${f.name}: pregătire…`);
        const r = await convertToGLB(f, (m) => setBusy(`${f.name}: ${m}`));
        const glb = new File([r.blob], r.fileName, { type: 'model/gltf-binary' });
        await add(glb, target, { name: f.name.replace(/\.[^.]+$/, ''), scale: r.unitScale });
        setStatus(`Model importat: ${f.name} (${r.info})${target === 'CUSTOM' ? ' – plasare liberă' : ` → ${target}`}`);
      } catch (e) {
        setStatus(`Eroare la ${f.name}: ${(e as Error).message}`);
      } finally {
        setBusy(null);
      }
    }
  };

  return (
    <div className="text-xs">
      <div className="ps-title">Modele CAD (glTF / GLB)</div>
      <div className="px-2 py-1 flex gap-1">
        <button className="ps-btn flex-1" onClick={() => exportProject().then(() => setStatus('Proiect salvat (.mcri.json)'))} title="Salvează layout + modele + animație + programe într-un singur fișier">
          💾 Salvează proiect
        </button>
        <button className="ps-btn flex-1" onClick={() => projRef.current?.click()} title="Deschide un fișier .mcri.json (înlocuiește modelele curente)">
          📂 Deschide proiect
        </button>
        <input
          ref={projRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && confirm('Modelele și animația curente vor fi înlocuite. Continui?')) importProject(f).then(setStatus, (err) => setStatus(`Eroare: ${(err as Error).message}`));
            e.target.value = '';
          }}
        />
      </div>
      {layout === 'empty' && <div className="px-2 py-1 text-[10px] text-emerald-400">Celulă goală: modelele se plasează liber. Mută-le cu gizmo-ul din viewport (G / E) sau din câmpurile de mai jos.</div>}
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
          {busy ? (
            <span className="text-ps-accent">⏳ {busy}</span>
          ) : (
            <>
              Trage fișiere aici sau click pentru a alege
              <br />
              <span className="text-[10px]">STEP / STP / IGES / BREP · STL / OBJ / PLY / 3MF / DAE / FBX · GLB / GLTF – conversia se face în browser</span>
              <br />
              <span className="text-[10px]">(se pot trage și direct peste viewport-ul 3D)</span>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
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
      <div className="ps-title">Conversie în browser</div>
      <div className="px-2 py-1 text-[10px] text-ps-muted space-y-1">
        <div>• STEP / IGES / BREP: triangulare cu OpenCascade (WebAssembly, ~7 MB încărcați doar la prima conversie); culorile per față sunt păstrate; unități mm.</div>
        <div>• STL / OBJ / PLY / 3MF / DAE / FBX: loaderele Three.js. STL/OBJ nu au unități – verifică scara (mm / m / inch).</div>
        <div>• Rezultatul este GLB; butonul ⤓ îl descarcă pentru <code>public/models/</code>. Modele CAD cu Z în sus: butonul „Z↑”.</div>
        <div>• Fișiere STEP mari (&gt; 50 MB) pot dura zeci de secunde; simplifică ansamblurile în CAD înainte.</div>
      </div>
    </div>
  );
}
