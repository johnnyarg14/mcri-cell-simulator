import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import type { Object3D } from 'three';
import { ROBOTS } from '../config/cell.config';
import { engine } from '../sim/engine';
import { useAnimStore, evaluateTrack } from '../store/useAnimStore';
import { useModelStore } from '../store/useModelStore';
import { useSimStore } from '../store/useSimStore';
import { objectRegistry } from './registry';

const D = Math.PI / 180;

/** aplică animația pe cadre obiectelor din scenă (și axelor roboților) */
export function AnimDriver() {
  useFrame((_, delta) => {
    const a = useAnimStore.getState();
    if (!a.active) return;
    if (a.playing) {
      let f = a.frame + delta * a.fps;
      if (f > a.length) f = a.loop ? f % a.length : a.length;
      if (!a.loop && f >= a.length) useAnimStore.setState({ frame: a.length, playing: false });
      else useAnimStore.setState({ frame: f });
    }
    const f = useAnimStore.getState().frame;
    for (const t of a.tracks) {
      if (a.dragging === t.id) continue;
      const k = evaluateTrack(t, f, a.smooth);
      if (!k) continue;
      if (ROBOTS.some((r) => r.id === t.id)) {
        if (k.q) engine.applyJoints(t.id, k.q);
        continue;
      }
      const o = objectRegistry.get(t.id);
      if (!o) continue;
      if (k.pos) o.position.set(k.pos[0], k.pos[1], k.pos[2]);
      if (k.rot) o.rotation.set(k.rot[0] * D, k.rot[1] * D, k.rot[2] * D);
      if (k.scale) o.scale.set(k.scale[0], k.scale[1], k.scale[2]);
      if (k.visible !== undefined) o.visible = k.visible;
    }
  });
  return null;
}

/** citește transformarea curentă a unui obiect (mm / grade) – folosită la adăugarea cheilor */
export function readTransform(id: string): { pos: [number, number, number]; rot: [number, number, number]; scale: [number, number, number] } | null {
  const o = objectRegistry.get(id);
  if (!o) return null;
  return {
    pos: [o.position.x, o.position.y, o.position.z],
    rot: [o.rotation.x / D, o.rotation.y / D, o.rotation.z / D],
    scale: [o.scale.x, o.scale.y, o.scale.z],
  };
}

/** gizmo de transformare pentru modelul CAD selectat (plasare liberă) */
export function Gizmo() {
  const selectedId = useSimStore((s) => s.selectedId);
  const mode = useSimStore((s) => s.gizmo);
  const models = useModelStore((s) => s.models);
  const update = useModelStore((s) => s.update);
  const target = useRef<Object3D | null>(null);
  const model = selectedId ? models.find((m) => m.id === selectedId && m.objectId === 'CUSTOM') : undefined;
  const obj = model ? objectRegistry.get(model.id) : undefined;
  target.current = obj ?? null;
  useEffect(() => {
    return () => useAnimStore.getState().setDragging(null);
  }, [selectedId]);
  if (!obj || mode === 'off') return null;
  const onChange = () => {
    const o = target.current;
    if (!o || !model) return;
    // scrie înapoi în store (mm / grade) – în timpul drag-ului doar poziția obiectului se schimbă
    update(model.id, {
      position: [Math.round(o.position.x * 10) / 10, Math.round(o.position.y * 10) / 10, Math.round(o.position.z * 10) / 10],
      rotation: [Math.round(o.rotation.x / D), Math.round(o.rotation.y / D), Math.round(o.rotation.z / D)],
    });
    const a = useAnimStore.getState();
    if (a.active && a.autoKey) {
      const t = readTransform(model.id);
      if (t) a.addKey(model.id, model.name, { frame: Math.round(a.frame), ...t });
    }
  };
  return (
    <TransformControls
      object={obj}
      mode={mode}
      size={0.8}
      translationSnap={mode === 'translate' ? 10 : undefined}
      rotationSnap={mode === 'rotate' ? 5 * D : undefined}
      onMouseDown={() => useAnimStore.getState().setDragging(model!.id)}
      onMouseUp={() => {
        onChange();
        useAnimStore.getState().setDragging(null);
      }}
    />
  );
}
