import { useMemo } from 'react';
import { COLORS, PALLET_LINE, STATIONS } from '../config/cell.config';
import { Selectable } from './Selectable';
import { ModelOrPrimitive } from './ModelOrPrimitive';

/** o secțiune CDLR: cadre laterale, role, picioare */
function CdlrSection({ z0, z1 }: { z0: number; z1: number }) {
  const P = PALLET_LINE;
  const len = z1 - z0;
  const rollers = useMemo(() => {
    const out: number[] = [];
    for (let z = z0 + P.rollerPitch / 2; z < z1; z += P.rollerPitch) out.push(z);
    return out;
  }, [z0, z1, P.rollerPitch]);
  const cz = (z0 + z1) / 2;
  const frameY = P.tor - P.frameH / 2 + 10;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[P.x + s * (P.bf / 2 + 30), frameY, cz]} castShadow>
          <boxGeometry args={[60, P.frameH, len - 4]} />
          <meshStandardMaterial color={COLORS.ral5017} roughness={0.5} />
        </mesh>
      ))}
      {rollers.map((z) => (
        <mesh key={z} position={[P.x, P.tor - P.rollerDia / 2, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[P.rollerDia / 2, P.rollerDia / 2, P.bf, 12]} />
          <meshStandardMaterial color={COLORS.rollerGrey} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* lanț acționare (cutie laterală) */}
      <mesh position={[P.x + P.bf / 2 + 30, P.tor - P.frameH - 40, cz]}>
        <boxGeometry args={[80, 60, len - 100]} />
        <meshStandardMaterial color={COLORS.conveyorDark} />
      </mesh>
      {[z0 + 150, z1 - 150].map((z) =>
        [-1, 1].map((s) => (
          <mesh key={`${z}${s}`} position={[P.x + s * (P.bf / 2 + 30), (P.tor - P.frameH) / 2, z]}>
            <boxGeometry args={[60, P.tor - P.frameH, 60]} />
            <meshStandardMaterial color={COLORS.ral5017} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function PalletLine() {
  const W = STATIONS.wrapper;
  return (
    <group>
      {PALLET_LINE.zones.map((z) =>
        z.role === 'wrapper' ? null : (
          <Selectable key={z.id} id={z.id} name={z.name}>
            <ModelOrPrimitive name={z.id}>
              <CdlrSection z0={z.z0} z1={z.z1} />
            </ModelOrPrimitive>
          </Selectable>
        ),
      )}
      {/* masa rotativă a infoliatorului înlocuiește secțiunea S9 */}
      <Selectable id={W.id} name={W.name}>
        <ModelOrPrimitive name={W.id}>
          <WrapperStatic />
        </ModelOrPrimitive>
      </Selectable>
    </group>
  );
}

function WrapperStatic() {
  const W = STATIONS.wrapper;
  const P = PALLET_LINE;
  return (
    <group>
      {/* masă rotativă (cadru static + disc) – discul se rotește în WrapperDynamic */}
      <mesh position={[W.center.x, (P.tor - W.turntableH) / 2, W.center.z]}>
        <boxGeometry args={[W.turntableDia + 200, P.tor - W.turntableH, W.turntableDia + 200]} />
        <meshStandardMaterial color={COLORS.ral5017} />
      </mesh>
      {/* catarg */}
      <mesh position={[W.mastPos.x, W.mast.h / 2, W.mastPos.z]} castShadow>
        <boxGeometry args={[W.mast.w, W.mast.h, W.mast.d]} />
        <meshStandardMaterial color={COLORS.ral5017} />
      </mesh>
      <mesh position={[W.mastPos.x, W.mast.h + 60, W.mastPos.z]}>
        <boxGeometry args={[W.mast.w + 100, 120, W.mast.d + 100]} />
        <meshStandardMaterial color={COLORS.ral1023} />
      </mesh>
      {/* dulap comandă */}
      <mesh position={[W.mastPos.x + 500, 600, W.mastPos.z + 500]}>
        <boxGeometry args={[400, 1200, 300]} />
        <meshStandardMaterial color={COLORS.steel} />
      </mesh>
    </group>
  );
}
