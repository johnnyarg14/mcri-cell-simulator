import { create } from 'zustand';
import { SIM, type CameraPresetId } from '../config/cell.config';
import { engine } from '../sim/engine';
import type { Snapshot } from '../sim/types';

export type TreeFolder = 'Roboți' | 'Conveioare' | 'Echipamente' | 'Produse' | 'Siguranță';

interface SimStore {
  playing: boolean;
  speed: number;
  snapshot: Snapshot;
  selectedId: string | null;
  hidden: Record<string, boolean>;
  wireframe: boolean;
  showCollisions: boolean;
  showReach: boolean;
  showGrid: boolean;
  bottomCollapsed: boolean;
  viewRequest: { preset: CameraPresetId; n: number };
  captureRequest: number;
  fps: number;
  statusMessage: string;
  productsVersion: number;
  play(): void;
  pause(): void;
  stop(): void;
  stepOnce(): void;
  reset(): void;
  setSpeed(v: number): void;
  select(id: string | null): void;
  toggleHidden(id: string): void;
  setFlag(k: 'wireframe' | 'showCollisions' | 'showReach' | 'showGrid' | 'bottomCollapsed', v: boolean): void;
  requestView(p: CameraPresetId): void;
  requestCapture(): void;
  refresh(): void;
  setFps(v: number): void;
  setStatus(m: string): void;
}

export const useSimStore = create<SimStore>((set, get) => ({
  playing: false,
  speed: 1,
  snapshot: engine.snapshot(),
  selectedId: null,
  hidden: {},
  wireframe: false,
  showCollisions: true,
  showReach: false,
  showGrid: true,
  bottomCollapsed: false,
  viewRequest: { preset: 'iso', n: 0 },
  captureRequest: 0,
  fps: 0,
  statusMessage: 'Gata. Apasă Play pentru a porni simularea.',
  productsVersion: 0,
  play: () => {
    engine.resumeAuto();
    set({ playing: true, statusMessage: 'Simulare în curs' });
  },
  pause: () => set({ playing: false, statusMessage: 'Pauză' }),
  stop: () => {
    engine.jumpTo(0);
    set({ playing: false, snapshot: engine.snapshot(), statusMessage: 'Oprit – timp 00:00.0' });
  },
  stepOnce: () => {
    engine.resumeAuto();
    for (let i = 0; i < SIM.stepTicks; i++) engine.step();
    set({ playing: false, snapshot: engine.snapshot() });
  },
  reset: () => {
    engine.reset();
    set({ playing: false, snapshot: engine.snapshot(), selectedId: null, statusMessage: 'Reset complet' });
  },
  setSpeed: (v) => set({ speed: Math.max(SIM.speedRange.min, Math.min(SIM.speedRange.max, v)) }),
  select: (id) => set({ selectedId: id }),
  toggleHidden: (id) => set((s) => ({ hidden: { ...s.hidden, [id]: !s.hidden[id] } })),
  setFlag: (k, v) => {
    if (k === 'showCollisions') engine.collisionEnabled = v;
    set({ [k]: v } as Partial<SimStore>);
  },
  requestView: (p) => set((s) => ({ viewRequest: { preset: p, n: s.viewRequest.n + 1 } })),
  requestCapture: () => set((s) => ({ captureRequest: s.captureRequest + 1 })),
  refresh: () => {
    const snap = engine.snapshot();
    const coll = snap.robots.find((r) => r.collision);
    const msg = coll
      ? `Coliziune: Gripper ${coll.id === 'ROBOT_1' ? 'R1' : 'R2'} ↔ ${coll.collision}`
      : snap.messages.length
        ? snap.messages[snap.messages.length - 1]
        : get().statusMessage;
    set({ snapshot: snap, statusMessage: msg });
  },
  setFps: (v) => set({ fps: v }),
  setStatus: (m) => set({ statusMessage: m }),
}));

// produsele se re-randează când motorul anunță o schimbare structurală (spawn/despawn)
engine.onChange(() => useSimStore.setState({ productsVersion: engine.productsVersion }));
