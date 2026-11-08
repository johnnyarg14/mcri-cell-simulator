import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial, DoubleSide } from 'three';
import { COLORS, type RobotConfig } from '../config/cell.config';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import { Selectable } from './Selectable';
import { ModelOrPrimitive } from './ModelOrPrimitive';

const yellow = { color: COLORS.fanucYellow, roughness: 0.45, metalness: 0.15 };
const black = { color: COLORS.fanucBlack, roughness: 0.6 };
const steel = { color: COLORS.steel, metalness: 0.7, roughness: 0.3 };

/** scula: placă + ventuze în cadrul flanșei (Z = direcția de apropiere, spre TCP) */
function Tool({ cfg, matRef }: { cfg: RobotConfig; matRef: React.RefObject<MeshStandardMaterial | null> }) {
  const t = cfg.tool;
  const plateZ = t.tcpOffset - t.cupLen - t.plateT / 2;
  const cups = useMemo(() => {
    const out: [number, number][] = [];
    if (t.kind === 'layer') {
      for (let i = 0; i < 4; i++) for (const y of [-90, 90]) out.push([-495 + i * 330, y]);
    } else {
      for (const x of [-80, 80]) for (const y of [-80, 80]) out.push([x, y]);
    }
    return out;
  }, [t.kind]);
  return (
    <group>
      {/* flanșă → suport */}
      <mesh position={[0, 0, (t.tcpOffset - t.cupLen - t.plateT) / 2]}>
        <cylinderGeometry args={[t.kind === 'layer' ? 110 : 55, t.kind === 'layer' ? 110 : 55, t.tcpOffset - t.cupLen - t.plateT, 16]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, 0, plateZ]} castShadow>
        <boxGeometry args={[t.plateL, t.plateW, t.plateT]} />
        <meshStandardMaterial ref={matRef} color={COLORS.ral5017} roughness={0.5} />
      </mesh>
      {cups.map(([x, y], i) => (
        <mesh key={i} position={[x, y, t.tcpOffset - t.cupLen / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[t.kind === 'layer' ? 60 : 45, t.kind === 'layer' ? 75 : 55, t.cupLen, 14]} />
          <meshStandardMaterial color="#444" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** geometrie link-uri pentru M-410iC (paletizare, paralelogram) */
function M410Links({ cfg, refs }: { cfg: RobotConfig; refs: React.MutableRefObject<(Group | null)[]> }) {
  const [, j2, j3, wl, j4] = cfg.chain;
  const a1 = j2.translate[0];
  const h1 = j2.translate[1];
  const L2 = j3.translate[1];
  const L3 = wl.translate[0];
  const d4 = -j4.translate[1];
  return (
    <>
      {/* turela J1 */}
      <group ref={(g) => (refs.current[0] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, 120, 0]} castShadow>
          <cylinderGeometry args={[520, 560, 240, 32]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[a1 / 2 - 60, 240 + (h1 - 240) / 2, 0]} castShadow>
          <boxGeometry args={[720, h1 - 240, 620]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        {/* motoare J2/J3 */}
        <mesh position={[a1 - 100, h1, 430]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[160, 160, 260, 20]} />
          <meshStandardMaterial {...black} />
        </mesh>
        <mesh position={[a1 - 100, h1, -430]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[160, 160, 260, 20]} />
          <meshStandardMaterial {...black} />
        </mesh>
        {/* contragreutate */}
        <mesh position={[-a1 - 380, h1 - 100, 0]} castShadow>
          <boxGeometry args={[420, 520, 520]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      {/* braț inferior J2 */}
      <group ref={(g) => (refs.current[1] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, L2 / 2, 0]} castShadow>
          <boxGeometry args={[240, L2 + 120, 300]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[170, 170, 340, 24]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        {/* tijă paralelogram (vizual) */}
        <mesh position={[-180, L2 / 2, 0]}>
          <boxGeometry args={[60, L2, 80]} />
          <meshStandardMaterial {...black} />
        </mesh>
      </group>
      {/* braț superior J3 */}
      <group ref={(g) => (refs.current[2] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[150, 150, 360, 24]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[L3 / 2, 20, 0]} castShadow>
          <boxGeometry args={[L3, 220, 260]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      {/* încheietură (menținută orizontală) */}
      <group ref={(g) => (refs.current[3] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, -d4 / 2 + 20, 0]} castShadow>
          <cylinderGeometry args={[140, 160, d4 + 40, 24]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      {/* flanșă J4 */}
      <group ref={(g) => (refs.current[4] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, -25, 0]}>
          <cylinderGeometry args={[150, 150, 50, 24]} />
          <meshStandardMaterial {...black} />
        </mesh>
      </group>
    </>
  );
}

/** geometrie link-uri pentru M-20iB (6 axe) */
function M20Links({ cfg, refs }: { cfg: RobotConfig; refs: React.MutableRefObject<(Group | null)[]> }) {
  const [j1, j2, j3, j4, j5, j6] = cfg.chain;
  const d1 = j1.translate[1];
  const a1 = j2.translate[0];
  const a2 = j3.translate[1];
  const a3 = j4.translate[1];
  const d4 = j5.translate[0];
  const d6 = j6.translate[0];
  return (
    <>
      <group ref={(g) => (refs.current[0] = g)} matrixAutoUpdate={false}>
        {/* coloană J1 (de la bază până la J2) */}
        <mesh position={[0, -d1 / 2 + 60, 0]} castShadow>
          <cylinderGeometry args={[190, 230, d1 - 120, 24]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[a1 / 2, 0, 0]} castShadow>
          <boxGeometry args={[320 + a1, 380, 400]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[a1, 0, 260]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[120, 120, 160, 20]} />
          <meshStandardMaterial {...black} />
        </mesh>
      </group>
      <group ref={(g) => (refs.current[1] = g)} matrixAutoUpdate={false}>
        <mesh position={[0, a2 / 2, -60]} castShadow>
          <boxGeometry args={[200, a2 + 100, 180]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -60]}>
          <cylinderGeometry args={[150, 150, 200, 24]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      <group ref={(g) => (refs.current[2] = g)} matrixAutoUpdate={false}>
        <mesh position={[40, a3 / 2, 0]} castShadow>
          <boxGeometry args={[320, a3 + 220, 240]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
        <mesh position={[-120, a3 + 40, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[100, 100, 260, 20]} />
          <meshStandardMaterial {...black} />
        </mesh>
      </group>
      <group ref={(g) => (refs.current[3] = g)} matrixAutoUpdate={false}>
        <mesh position={[d4 / 2 - 40, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[85, 100, d4 - 80, 20]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      <group ref={(g) => (refs.current[4] = g)} matrixAutoUpdate={false}>
        <mesh position={[30, 0, 0]}>
          <boxGeometry args={[140, 170, 210]} />
          <meshStandardMaterial {...yellow} />
        </mesh>
      </group>
      <group ref={(g) => (refs.current[5] = g)} matrixAutoUpdate={false}>
        <mesh position={[-d6 / 2 + 10, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[55, 70, d6 - 20, 20]} />
          <meshStandardMaterial {...black} />
        </mesh>
      </group>
    </>
  );
}

export function Robot({ cfg }: { cfg: RobotConfig }) {
  const refs = useRef<(Group | null)[]>([]);
  const flangeRef = useRef<Group>(null);
  const toolMat = useRef<MeshStandardMaterial>(null);
  const reachRef = useRef<Mesh>(null);
  const showReach = useSimStore((s) => s.showReach);
  const showCollisions = useSimStore((s) => s.showCollisions);

  useFrame(() => {
    const r = engine.robots[cfg.id];
    if (!r) return;
    const frames = r.fk.frames;
    for (let i = 0; i < refs.current.length; i++) {
      const g = refs.current[i];
      if (!g) continue;
      g.matrix.copy(frames[i]);
      g.matrixWorldNeedsUpdate = true;
    }
    if (flangeRef.current) {
      flangeRef.current.matrix.copy(r.fk.flange);
      flangeRef.current.matrixWorldNeedsUpdate = true;
    }
    if (toolMat.current) {
      const col = showCollisions && r.collision ? COLORS.collision : r.carried.length ? '#1f8a4c' : COLORS.ral5017;
      toolMat.current.color.set(col);
      toolMat.current.emissive.set(showCollisions && r.collision ? '#550000' : '#000000');
    }
    if (reachRef.current) {
      const j2 = frames[1];
      reachRef.current.position.set(j2.elements[12], j2.elements[13], j2.elements[14]);
    }
  });

  const mount = cfg.mount;
  return (
    <group>
      {/* riser / piedestal */}
      <Selectable id={cfg.id + '_MOUNT'} name={mount.name}>
        <ModelOrPrimitive name={cfg.id + '_MOUNT'}>
          <group position={[cfg.base.x, 0, cfg.base.z]}>
            <mesh position={[0, mount.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[mount.w, mount.h, mount.d]} />
              <meshStandardMaterial color={COLORS.ral5017} roughness={0.5} />
            </mesh>
            <mesh position={[0, 15, 0]}>
              <boxGeometry args={[mount.w + 200, 30, mount.d + 200]} />
              <meshStandardMaterial color={COLORS.fanucBlack} />
            </mesh>
            {mount.kind === 'riser' && (
              <mesh position={[0, mount.h - 15, 0]}>
                <boxGeometry args={[mount.w + 60, 30, mount.d + 60]} />
                <meshStandardMaterial color={COLORS.steel} metalness={0.6} />
              </mesh>
            )}
          </group>
        </ModelOrPrimitive>
      </Selectable>
      <Selectable id={cfg.id} name={cfg.name}>
        <ModelOrPrimitive name={cfg.id}>
          {/* bază fixă */}
          <mesh position={[cfg.base.x, cfg.base.y + 40, cfg.base.z]}>
            <cylinderGeometry args={[cfg.axes === 4 ? 560 : 230, cfg.axes === 4 ? 600 : 260, 80, 32]} />
            <meshStandardMaterial {...black} />
          </mesh>
          {cfg.axes === 4 ? <M410Links cfg={cfg} refs={refs} /> : <M20Links cfg={cfg} refs={refs} />}
        </ModelOrPrimitive>
        <group ref={flangeRef} matrixAutoUpdate={false}>
          <ModelOrPrimitive name={cfg.tool.id}>
            <Tool cfg={cfg} matRef={toolMat} />
          </ModelOrPrimitive>
        </group>
      </Selectable>
      {/* anvelopa de lucru */}
      <mesh ref={reachRef} visible={showReach}>
        <sphereGeometry args={[cfg.reach, 48, 24]} />
        <meshBasicMaterial color={cfg.id === 'ROBOT_1' ? '#3b9cff' : '#ff9f1a'} transparent opacity={0.08} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh visible={showReach} position={[cfg.base.x, 2, cfg.base.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cfg.reach - 15, cfg.reach, 96]} />
        <meshBasicMaterial color={cfg.id === 'ROBOT_1' ? '#3b9cff' : '#ff9f1a'} transparent opacity={0.6} side={DoubleSide} />
      </mesh>
    </group>
  );
}
