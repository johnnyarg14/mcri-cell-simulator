import { useMemo } from 'react';
import { COLORS, FENCE } from '../config/cell.config';
import { buildFence } from './fence';
import { Selectable } from './Selectable';

export function Fence() {
  const { posts, panels } = useMemo(() => buildFence(), []);
  const F = FENCE;
  return (
    <Selectable id="FENCE" name="Gard de protecție">
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, F.panelHeight / 2, p.z]} castShadow>
          <boxGeometry args={[F.postSize, F.panelHeight, F.postSize]} />
          <meshStandardMaterial color={COLORS.ral1023} roughness={0.6} />
        </mesh>
      ))}
      {panels.map((p, i) => {
        const h = p.y1 - p.y0;
        const cy = (p.y0 + p.y1) / 2;
        const size: [number, number, number] = p.axis === 'x' ? [p.len, h, 16] : [16, h, p.len];
        const railSize: [number, number, number] = p.axis === 'x' ? [p.len, 30, 30] : [30, 30, p.len];
        return (
          <group key={i} position={[p.cx, cy, p.cz]}>
            <mesh>
              <boxGeometry args={size} />
              <meshStandardMaterial
                color={p.kind === 'door' ? COLORS.ral5017 : COLORS.ral1023}
                transparent
                opacity={p.kind === 'door' ? 0.7 : 0.28}
                roughness={0.8}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[0, h / 2 - 15, 0]}>
              <boxGeometry args={railSize} />
              <meshStandardMaterial color={COLORS.ral1023} />
            </mesh>
            <mesh position={[0, -h / 2 + 15, 0]}>
              <boxGeometry args={railSize} />
              <meshStandardMaterial color={COLORS.ral1023} />
            </mesh>
          </group>
        );
      })}
    </Selectable>
  );
}
