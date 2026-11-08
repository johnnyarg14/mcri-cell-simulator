import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial, DoubleSide } from 'three';
import { COLORS, SAFETY } from '../config/cell.config';
import { engine } from '../sim/engine';
import { Selectable } from './Selectable';

function EStop({ id, name, pos, rotY }: (typeof SAFETY.estops)[number]) {
  return (
    <Selectable id={id} name={name} position={[pos.x, pos.y, pos.z]} rotation={[0, (rotY * Math.PI) / 180, 0]}>
      <mesh>
        <boxGeometry args={[40, 120, 90]} />
        <meshStandardMaterial color={COLORS.ral1023} />
      </mesh>
      <mesh position={[30, 15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[28, 24, 30, 16]} />
        <meshStandardMaterial color="#e01010" />
      </mesh>
    </Selectable>
  );
}

function LightCurtain({ id, name, center, span, height }: (typeof SAFETY.lightCurtains)[number]) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    // interuptă dacă un palet trece prin planul barierei
    let interrupted = false;
    for (const p of engine.products.values()) {
      if (p.kind === 'pallet' && Math.abs(p.z - center.z) < 700) interrupted = true;
    }
    mat.current.opacity = interrupted ? 0.45 : 0.12 + 0.05 * Math.sin(clock.elapsedTime * 6);
    mat.current.color.set(interrupted ? '#ff2020' : COLORS.lightCurtain);
  });
  return (
    <Selectable id={id} name={name}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[center.x + (s * span) / 2, 400 + height / 2, center.z]}>
          <boxGeometry args={[60, height + 800, 60]} />
          <meshStandardMaterial color={COLORS.ral1023} />
        </mesh>
      ))}
      <mesh position={[center.x, 400 + height / 2, center.z]}>
        <planeGeometry args={[span - 60, height]} />
        <meshStandardMaterial ref={mat} color={COLORS.lightCurtain} transparent opacity={0.15} side={DoubleSide} depthWrite={false} emissive={COLORS.lightCurtain} emissiveIntensity={0.5} />
      </mesh>
    </Selectable>
  );
}

function FloorMarking({ id, name, rect, lineW }: (typeof SAFETY.floorMarkings)[number]) {
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const cx = (rect.x0 + rect.x1) / 2;
  const cz = (rect.z0 + rect.z1) / 2;
  const y = 3;
  return (
    <Selectable id={id} name={name}>
      {[
        [cx, rect.z0, w, lineW],
        [cx, rect.z1, w, lineW],
        [rect.x0, cz, lineW, d],
        [rect.x1, cz, lineW, d],
      ].map(([x, z, sw, sd], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sw, sd]} />
          <meshStandardMaterial color={COLORS.floorLine} roughness={0.9} />
        </mesh>
      ))}
    </Selectable>
  );
}

export function Safety() {
  return (
    <group>
      {SAFETY.estops.map((e) => (
        <EStop key={e.id} {...e} />
      ))}
      {SAFETY.lightCurtains.map((l) => (
        <LightCurtain key={l.id} {...l} />
      ))}
      {SAFETY.floorMarkings.map((m) => (
        <FloorMarking key={m.id} {...m} />
      ))}
    </group>
  );
}
