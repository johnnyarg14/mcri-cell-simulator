import { useAnimStore, type AnimationData } from '../store/useAnimStore';
import { useModelStore, type RuntimeModel } from '../store/useModelStore';
import { useSimStore } from '../store/useSimStore';
import { engine } from '../sim/engine';
import type { RobotProgram } from '../sim/types';

/** fișier de proiect .mcri.json: layout + modele CAD (base64) + animație + programe robot */
interface ProjectFile {
  app: 'mcri-cell-simulator';
  version: 1;
  savedAt: string;
  layout: 'mcri' | 'empty';
  models: (RuntimeModel & { data: string })[]; // base64 GLB
  animation: AnimationData;
  programs: Record<string, RobotProgram>;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
function fromBase64(b64: string, type = 'model/gltf-binary'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportProject() {
  const ms = useModelStore.getState();
  const models: ProjectFile['models'] = [];
  for (const m of ms.models) {
    const blob = ms.getBlob(m.id);
    if (!blob) continue;
    models.push({ ...m, data: await toBase64(blob) });
  }
  const pf: ProjectFile = {
    app: 'mcri-cell-simulator',
    version: 1,
    savedAt: new Date().toISOString(),
    layout: useSimStore.getState().layout,
    models,
    animation: useAnimStore.getState().toJSON(),
    programs: Object.fromEntries(Object.values(engine.robots).map((r) => [r.cfg.id, r.program])),
  };
  const blob = new Blob([JSON.stringify(pf)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `proiect_${new Date().toISOString().slice(0, 10)}.mcri.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importProject(file: File): Promise<string> {
  const pf = JSON.parse(await file.text()) as ProjectFile;
  if (pf.app !== 'mcri-cell-simulator') throw new Error('nu este un fișier de proiect MCRI');
  const ms = useModelStore.getState();
  for (const m of ms.models.slice()) await ms.remove(m.id);
  for (const m of pf.models) {
    const { data, ...meta } = m;
    await ms.addFromBlob(meta, fromBase64(data, /\.gltf$/i.test(meta.fileName) ? 'model/gltf+json' : 'model/gltf-binary'));
  }
  useAnimStore.getState().load(pf.animation);
  for (const [id, p] of Object.entries(pf.programs ?? {})) engine.setProgram(id, p);
  useSimStore.getState().setLayout(pf.layout ?? 'mcri');
  return `Proiect încărcat: ${pf.models.length} modele, ${pf.animation.tracks.length} piste de animație`;
}
