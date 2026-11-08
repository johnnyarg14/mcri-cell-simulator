import { create } from 'zustand';
import { idbDelete, idbGetAll, idbPut } from '../utils/idb';

/** model glTF importat la rulare (din browser), atribuit unui obiect din scenă sau plasat liber */
export interface RuntimeModel {
  id: string;
  name: string;
  fileName: string;
  size: number;
  objectId: string; // id obiect din Object Tree sau 'CUSTOM' (plasare liberă)
  scale: number; // 1 = mm, 1000 = model în metri
  position: [number, number, number]; // mm
  rotation: [number, number, number]; // grade
  visible: boolean;
}

type Stored = { meta: RuntimeModel; blob: Blob };

interface ModelStore {
  models: RuntimeModel[];
  urls: Record<string, string>;
  loaded: boolean;
  load(): Promise<void>;
  add(file: File, objectId: string, extra?: Partial<RuntimeModel>): Promise<RuntimeModel>;
  update(id: string, patch: Partial<RuntimeModel>): void;
  remove(id: string): Promise<void>;
  manifest(): Record<string, unknown>;
}

const blobs = new Map<string, Blob>();

export const useModelStore = create<ModelStore>((set, get) => ({
  models: [],
  urls: {},
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const all = await idbGetAll<Stored>();
      const urls: Record<string, string> = {};
      const models: RuntimeModel[] = [];
      for (const { key, value } of all) {
        blobs.set(key, value.blob);
        urls[key] = URL.createObjectURL(value.blob);
        models.push(value.meta);
      }
      set({ models, urls, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  add: async (file, objectId, extra = {}) => {
    const id = `MODEL_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
    const meta: RuntimeModel = {
      id,
      name: extra.name ?? file.name.replace(/\.(glb|gltf)$/i, ''),
      fileName: file.name,
      size: file.size,
      objectId,
      scale: extra.scale ?? 1,
      position: extra.position ?? [0, 0, 0],
      rotation: extra.rotation ?? [0, 0, 0],
      visible: true,
    };
    blobs.set(id, file);
    const url = URL.createObjectURL(file);
    set((s) => ({ models: [...s.models, meta], urls: { ...s.urls, [id]: url } }));
    try {
      await idbPut<Stored>(id, { meta, blob: file });
    } catch (e) {
      console.warn('IndexedDB indisponibil – modelul nu va persista după reload', e);
    }
    return meta;
  },
  update: (id, patch) => {
    set((s) => ({ models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    const meta = get().models.find((m) => m.id === id);
    const blob = blobs.get(id);
    if (meta && blob) idbPut<Stored>(id, { meta, blob }).catch(() => undefined);
  },
  remove: async (id) => {
    const url = get().urls[id];
    if (url) URL.revokeObjectURL(url);
    blobs.delete(id);
    set((s) => {
      const urls = { ...s.urls };
      delete urls[id];
      return { models: s.models.filter((m) => m.id !== id), urls };
    });
    await idbDelete(id).catch(() => undefined);
  },
  manifest: () => {
    const out: Record<string, unknown> = {};
    for (const m of get().models) {
      const key = m.objectId === 'CUSTOM' ? m.id : m.objectId;
      out[key] = { file: m.fileName, scale: m.scale, position: m.position, rotation: m.rotation, ...(m.objectId === 'CUSTOM' ? { custom: true, name: m.name } : {}) };
    }
    return out;
  },
}));
