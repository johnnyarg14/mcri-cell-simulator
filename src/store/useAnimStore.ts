import { create } from 'zustand';

/**
 * Animație pe cadre (keyframes). O „pistă” per obiect (id din Object Tree / model importat / robot).
 * Pentru roboți cheia conține `q` (axe, grade); pentru restul obiectelor poziție (mm), rotație (grade, XYZ), scară, vizibilitate.
 */
export interface Keyframe {
  frame: number;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  q?: number[];
  visible?: boolean;
}
export interface Track {
  id: string;
  name: string;
  keys: Keyframe[]; // sortate după frame
}
export interface AnimationData {
  fps: number;
  length: number; // cadre
  loop: boolean;
  smooth: boolean; // interpolare smoothstep în loc de liniară
  tracks: Track[];
}

interface AnimStore extends AnimationData {
  frame: number; // cadru curent (poate fi fracționar la redare)
  playing: boolean;
  active: boolean; // editorul de animație conduce scena
  autoKey: boolean;
  dragging: string | null; // obiect mutat cu gizmo (nu se suprascrie de driver)
  setFrame(f: number): void;
  play(): void;
  pause(): void;
  setActive(v: boolean): void;
  setFps(v: number): void;
  setLength(v: number): void;
  setLoop(v: boolean): void;
  setSmooth(v: boolean): void;
  setAutoKey(v: boolean): void;
  setDragging(id: string | null): void;
  addKey(id: string, name: string, key: Keyframe): void;
  removeKey(id: string, frame: number): void;
  removeTrack(id: string): void;
  moveKey(id: string, from: number, to: number): void;
  load(data: AnimationData): void;
  clear(): void;
  toJSON(): AnimationData;
}

const STORAGE = 'mcri.animation';
function persisted(): Partial<AnimationData> {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? (JSON.parse(raw) as AnimationData) : {};
  } catch {
    return {};
  }
}
function save(d: AnimationData) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

const init = persisted();

export const useAnimStore = create<AnimStore>((set, get) => {
  const persist = () => save(get().toJSON());
  return {
    fps: init.fps ?? 25,
    length: init.length ?? 250,
    loop: init.loop ?? true,
    smooth: init.smooth ?? true,
    tracks: init.tracks ?? [],
    frame: 0,
    playing: false,
    active: false,
    autoKey: true,
    dragging: null,
    setFrame: (f) => set((s) => ({ frame: Math.max(0, Math.min(s.length, f)) })),
    play: () => set({ playing: true, active: true }),
    pause: () => set({ playing: false }),
    setActive: (v) => set({ active: v, playing: v ? get().playing : false }),
    setFps: (v) => {
      set({ fps: Math.max(1, Math.min(120, v)) });
      persist();
    },
    setLength: (v) => {
      set({ length: Math.max(1, Math.min(100000, Math.round(v))) });
      persist();
    },
    setLoop: (v) => {
      set({ loop: v });
      persist();
    },
    setSmooth: (v) => {
      set({ smooth: v });
      persist();
    },
    setAutoKey: (v) => set({ autoKey: v }),
    setDragging: (id) => set({ dragging: id }),
    addKey: (id, name, key) => {
      set((s) => {
        const tracks = s.tracks.slice();
        let t = tracks.find((x) => x.id === id);
        if (!t) {
          t = { id, name, keys: [] };
          tracks.push(t);
        } else t = { ...t, keys: t.keys.slice() };
        const f = Math.round(key.frame);
        const i = t.keys.findIndex((k) => k.frame === f);
        const nk = { ...key, frame: f };
        if (i >= 0) t.keys[i] = { ...t.keys[i], ...nk };
        else t.keys.push(nk);
        t.keys.sort((a, b) => a.frame - b.frame);
        return { tracks: tracks.map((x) => (x.id === id ? t! : x)) };
      });
      persist();
    },
    removeKey: (id, frame) => {
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, keys: t.keys.filter((k) => k.frame !== frame) } : t)).filter((t) => t.keys.length > 0) }));
      persist();
    },
    removeTrack: (id) => {
      set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) }));
      persist();
    },
    moveKey: (id, from, to) => {
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (t.id !== id) return t;
          const keys = t.keys.filter((k) => k.frame !== to).map((k) => (k.frame === from ? { ...k, frame: to } : k));
          keys.sort((a, b) => a.frame - b.frame);
          return { ...t, keys };
        }),
      }));
      persist();
    },
    load: (d) => {
      set({ fps: d.fps ?? 25, length: d.length ?? 250, loop: d.loop ?? true, smooth: d.smooth ?? true, tracks: d.tracks ?? [], frame: 0 });
      persist();
    },
    clear: () => {
      set({ tracks: [], frame: 0, playing: false });
      persist();
    },
    toJSON: () => {
      const s = get();
      return { fps: s.fps, length: s.length, loop: s.loop, smooth: s.smooth, tracks: s.tracks };
    },
  };
});

const sm = (u: number) => u * u * (3 - 2 * u);

/** evaluează o pistă la cadrul f: interpolare liniară / smoothstep între chei; hold în afara lor */
export function evaluateTrack(t: Track, f: number, smooth: boolean): Keyframe | null {
  const keys = t.keys;
  if (keys.length === 0) return null;
  if (f <= keys[0].frame) return keys[0];
  if (f >= keys[keys.length - 1].frame) return keys[keys.length - 1];
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].frame <= f) i++;
  const a = keys[i];
  const b = keys[i + 1];
  let u = (f - a.frame) / Math.max(1e-6, b.frame - a.frame);
  if (smooth) u = sm(u);
  const lerp3 = (x?: [number, number, number], y?: [number, number, number]) => (x && y ? ([x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u] as [number, number, number]) : (x ?? y));
  const q = a.q && b.q ? a.q.map((v, k) => v + ((b.q![k] ?? v) - v) * u) : (a.q ?? b.q);
  return { frame: f, pos: lerp3(a.pos, b.pos), rot: lerp3(a.rot, b.rot), scale: lerp3(a.scale, b.scale), q, visible: a.visible ?? b.visible };
}
