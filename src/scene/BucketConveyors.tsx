import { useMemo } from 'react';
import { BUCKET_LINE, COLORS } from '../config/cell.config';
import { Selectable } from './Selectable';
import { ModelOrPrimitive } from './ModelOrPrimitive';

type Seg = { cx: number; cz: number; len: number; yaw: number };

function segments(path: { x: number; z: number }[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    out.push({ cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, len: Math.hypot(dx, dz), yaw: Math.atan2(-dz, dx) });
  }
  return out;
}

function ConveyorBody({ id }: { id: string }) {
  const cfg = BUCKET_LINE.conveyors.find((c) => c.id === id)!;
  const segs = useMemo(() => segments(cfg.path), [cfg]);
  const B = BUCKET_LINE;
  const isCurve = segs.length > 2;
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.cx, 0, s.cz]} rotation={[0, s.yaw, 0]}>
          {/* bandă / role */}
          <mesh position={[0, B.tor - 10, 0]} receiveShadow>
            <boxGeometry args={[s.len + (isCurve ? 60 : 0), 20, B.bf]} />
            <meshStandardMaterial color={COLORS.conveyorDark} roughness={0.9} />
          </mesh>
          {/* cadre laterale */}
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0, B.tor - B.frameH / 2 - 10, k * (B.bf / 2 + 20)]}>
              <boxGeometry args={[s.len + (isCurve ? 60 : 0), B.frameH, 40]} />
              <meshStandardMaterial color={COLORS.conveyorGrey} metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
          {/* ghidaje laterale */}
          {[-1, 1].map((k) => (
            <mesh key={`g${k}`} position={[0, B.tor + B.guideRailH - 15, k * B.guideRailOffset]}>
              <boxGeometry args={[s.len + (isCurve ? 60 : 0), 30, 20]} />
              <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
          {[-1, 1].map((k) => (
            <mesh key={`gp${k}`} position={[0, B.tor + B.guideRailH / 2, k * B.guideRailOffset]}>
              <boxGeometry args={[isCurve ? 40 : Math.max(40, s.len - 100), B.guideRailH - 30, 8]} />
              <meshStandardMaterial color={COLORS.steel} transparent opacity={0.35} />
            </mesh>
          ))}
          {/* picioare */}
          {!isCurve &&
            Array.from({ length: Math.max(2, Math.floor(s.len / B.legPitch) + 1) }, (_, j) => {
              const x = -s.len / 2 + 200 + (j * (s.len - 400)) / Math.max(1, Math.floor(s.len / B.legPitch));
              return [-1, 1].map((k) => (
                <mesh key={`${j}${k}`} position={[x, (B.tor - B.frameH - 20) / 2, k * (B.bf / 2 + 20)]}>
                  <boxGeometry args={[50, B.tor - B.frameH - 20, 50]} />
                  <meshStandardMaterial color={COLORS.conveyorGrey} />
                </mesh>
              ));
            })}
        </group>
      ))}
      {isCurve && (
        <mesh position={[segs[0].cx + 0, (B.tor - B.frameH - 20) / 2, (segs[0].cz + segs[segs.length - 1].cz) / 2]}>
          <boxGeometry args={[50, B.tor - B.frameH - 20, 50]} />
          <meshStandardMaterial color={COLORS.conveyorGrey} />
        </mesh>
      )}
    </group>
  );
}

/** opritor pneumatic PCS19 (bloc pe partea laterală + lamă) și fotocelulă (senzor + reflector) */
function StopsAndSensors({ id }: { id: string }) {
  const cfg = BUCKET_LINE.conveyors.find((c) => c.id === id)!;
  const B = BUCKET_LINE;
  const path = useMemo(() => {
    const cum = [0];
    for (let i = 1; i < cfg.path.length; i++) cum.push(cum[i - 1] + Math.hypot(cfg.path[i].x - cfg.path[i - 1].x, cfg.path[i].z - cfg.path[i - 1].z));
    return (s: number) => {
      let i = 1;
      while (i < cfg.path.length - 1 && cum[i] < s) i++;
      const a = cfg.path[i - 1];
      const b = cfg.path[i];
      const u = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, yaw: Math.atan2(-(b.z - a.z), b.x - a.x) };
    };
  }, [cfg]);
  return (
    <group>
      {cfg.stops.map((st) => {
        const p = path(st.s);
        return (
          <Selectable key={st.id} id={st.id} name={st.name} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]}>
            <mesh position={[0, B.tor - 40, -(B.bf / 2 + 70)]}>
              <boxGeometry args={[120, 90, 60]} />
              <meshStandardMaterial color={COLORS.fanucBlack} />
            </mesh>
            <mesh position={[0, B.tor + 35, 0]}>
              <boxGeometry args={[14, 70, B.bf - 20]} />
              <meshStandardMaterial color={st.kind === 'reject' ? COLORS.reject : COLORS.ral1023} metalness={0.5} />
            </mesh>
          </Selectable>
        );
      })}
      {cfg.photocells.map((pc) => {
        const p = path(pc.s);
        return (
          <Selectable key={pc.id} id={pc.id} name={pc.name} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]}>
            <mesh position={[0, B.tor + 120, B.bf / 2 + 40]}>
              <boxGeometry args={[30, 50, 20]} />
              <meshStandardMaterial color="#222" emissive="#ff3030" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, B.tor + 120, -(B.bf / 2 + 40)]}>
              <boxGeometry args={[30, 50, 8]} />
              <meshStandardMaterial color="#ddd" />
            </mesh>
          </Selectable>
        );
      })}
    </group>
  );
}

export function BucketConveyors() {
  return (
    <group>
      {BUCKET_LINE.conveyors.map((c) => (
        <group key={c.id}>
          <Selectable id={c.id} name={c.name}>
            <ModelOrPrimitive name={c.id}>
              <ConveyorBody id={c.id} />
            </ModelOrPrimitive>
          </Selectable>
          <StopsAndSensors id={c.id} />
        </group>
      ))}
    </group>
  );
}
