import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { BUCKET_LINE, COLORS, PALLET, PALLET_LINE, SLIP_SHEET, STATIONS } from '../config/cell.config';
import { engine } from '../sim/engine';
import { Selectable } from './Selectable';
import { ModelOrPrimitive } from './ModelOrPrimitive';

const blue = { color: COLORS.ral5017, roughness: 0.5 };
const steel = { color: COLORS.steel, metalness: 0.6, roughness: 0.35 };

function Labeler() {
  const L = STATIONS.labeler;
  const arm = useRef<Mesh>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    const busy = engine.labeler.busy;
    if (arm.current) arm.current.position.z = L.offsetZ + L.box.d / 2 + (busy ? L.applicatorReach + 120 : 60);
    if (lamp.current) lamp.current.emissiveIntensity = busy ? 1.5 : 0.1;
  });
  return (
    <Selectable id={L.id} name={L.name}>
      <ModelOrPrimitive name={L.id}>
        <group position={[L.pos.x, 0, L.pos.z]}>
          <mesh position={[0, L.standH / 2, L.offsetZ]}>
            <boxGeometry args={[120, L.standH, 120]} />
            <meshStandardMaterial {...steel} />
          </mesh>
          <mesh position={[0, L.standH + L.box.h / 2, L.offsetZ]} castShadow>
            <boxGeometry args={[L.box.w, L.box.h, L.box.d]} />
            <meshStandardMaterial color="#d8dadf" roughness={0.4} />
          </mesh>
          {/* rolă etichete */}
          <mesh position={[-L.box.w / 2 - 10, L.standH + L.box.h - 150, L.offsetZ]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[150, 150, 60, 24]} />
            <meshStandardMaterial color="#f4f4f4" />
          </mesh>
          {/* braț aplicator (tamp) */}
          <mesh ref={arm} position={[0, BUCKET_LINE.tor + 200, L.offsetZ + L.box.d / 2 + 60]}>
            <boxGeometry args={[140, 110, 240]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0, L.standH + L.box.h + 60, L.offsetZ]}>
            <cylinderGeometry args={[30, 30, 120, 12]} />
            <meshStandardMaterial ref={lamp} color="#30c050" emissive="#30c050" emissiveIntensity={0.1} />
          </mesh>
        </group>
      </ModelOrPrimitive>
    </Selectable>
  );
}

function Vision() {
  const V = STATIONS.vision;
  const flash = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (flash.current) flash.current.emissiveIntensity = engine.vision.busy ? 1.2 + engine.vision.flash * 4 : 0.15;
  });
  const legH = V.archH;
  return (
    <Selectable id={V.id} name={V.name}>
      <ModelOrPrimitive name={V.id}>
        <group position={[V.pos.x, 0, V.pos.z]}>
          {/* 4 picioare */}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * (V.length / 2 - 40), legH / 2, sz * (V.width / 2 - 40)]}>
                <boxGeometry args={[60, legH, 60]} />
                <meshStandardMaterial {...blue} />
              </mesh>
            )),
          )}
          {/* boltă (jumătate de cilindru) */}
          <mesh position={[0, legH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[V.width / 2, V.width / 2, V.length, 24, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#cfd3d8" side={2} roughness={0.5} />
          </mesh>
          {/* panouri laterale */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, legH - 350, sz * (V.width / 2 - 5)]}>
              <boxGeometry args={[V.length, 700, 10]} />
              <meshStandardMaterial color="#cfd3d8" transparent opacity={0.5} />
            </mesh>
          ))}
          {/* camere: 1 sus + 2 laterale */}
          <mesh position={[0, legH + V.width / 2 - 60, 0]}>
            <boxGeometry args={[V.cameraSize, V.cameraSize, V.cameraSize * 1.6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, BUCKET_LINE.tor + 250, sz * (V.width / 2 - 80)]}>
              <boxGeometry args={[V.cameraSize, V.cameraSize, V.cameraSize * 1.6]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          ))}
          {/* iluminare */}
          <mesh position={[0, legH + 100, 0]}>
            <boxGeometry args={[V.length - 100, 20, 200]} />
            <meshStandardMaterial ref={flash} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} />
          </mesh>
        </group>
      </ModelOrPrimitive>
    </Selectable>
  );
}

function PusherAndChute() {
  const P = STATIONS.pusher;
  const C = STATIONS.chute;
  const rod = useRef<Group>(null);
  useFrame(() => {
    if (rod.current) rod.current.position.z = P.sideZ * (BUCKET_LINE.bf / 2 + 120) - P.sideZ * P.stroke * engine.pusher.ext;
  });
  const chuteLen = Math.hypot(C.end.z - C.start.z, C.bottomY - C.topY);
  const ang = Math.atan2(C.topY - C.bottomY, Math.abs(C.end.z - C.start.z));
  const B = STATIONS.chute.binSize;
  return (
    <>
      <Selectable id={P.id} name={P.name}>
        <ModelOrPrimitive name={P.id}>
          <group position={[P.pos.x, BUCKET_LINE.tor + 150, P.pos.z]}>
            <mesh position={[0, 0, P.sideZ * (BUCKET_LINE.bf / 2 + 320)]}>
              <cylinderGeometry args={[55, 55, 420, 16]} />
              <meshStandardMaterial {...steel} />
            </mesh>
            <mesh position={[0, -200, P.sideZ * (BUCKET_LINE.bf / 2 + 320)]}>
              <boxGeometry args={[120, 400, 120]} />
              <meshStandardMaterial {...blue} />
            </mesh>
            <group ref={rod}>
              <mesh position={[0, 0, P.sideZ * 250]}>
                <cylinderGeometry args={[25, 25, 500, 12]} />
                <meshStandardMaterial {...steel} />
              </mesh>
              <mesh>
                <boxGeometry args={[320, 200, 30]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            </group>
          </group>
        </ModelOrPrimitive>
      </Selectable>
      <Selectable id={C.id} name={C.name}>
        <ModelOrPrimitive name={C.id}>
          <group>
            <group position={[C.start.x, (C.topY + C.bottomY) / 2, (C.start.z + C.end.z) / 2]} rotation={[ang, 0, 0]}>
              <mesh>
                <boxGeometry args={[C.width, 12, chuteLen]} />
                <meshStandardMaterial {...steel} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * (C.width / 2 + 6), 60, 0]}>
                  <boxGeometry args={[12, 130, chuteLen]} />
                  <meshStandardMaterial {...steel} />
                </mesh>
              ))}
            </group>
            {/* container rebut */}
            <mesh position={[C.end.x, B.h / 2, C.end.z - 520]}>
              <boxGeometry args={[B.w, B.h, B.d]} />
              <meshStandardMaterial color={COLORS.reject} transparent opacity={0.45} />
            </mesh>
          </group>
        </ModelOrPrimitive>
      </Selectable>
    </>
  );
}

function WrapperDynamic() {
  const W = STATIONS.wrapper;
  const disc = useRef<Mesh>(null);
  const carriage = useRef<Mesh>(null);
  const film = useRef<Mesh>(null);
  useFrame(() => {
    const w = engine.wrapper;
    const pal = w.pallet ? engine.products.get(w.pallet) : null;
    if (disc.current) disc.current.rotation.y = ((pal?.spin ?? 0) * Math.PI) / 180;
    if (carriage.current) carriage.current.position.y = w.busy ? w.carriageY : 300;
    if (film.current) {
      film.current.visible = w.busy;
      const h = 200 + w.progress * (PALLET.h + 3 * 374);
      film.current.scale.set(1, h / 1000, 1);
      film.current.position.y = PALLET_LINE.tor + h / 2;
    }
  });
  return (
    <group>
      <mesh ref={disc} position={[W.center.x, PALLET_LINE.tor - W.turntableH / 2, W.center.z]}>
        <cylinderGeometry args={[W.turntableDia / 2, W.turntableDia / 2, W.turntableH, 48]} />
        <meshStandardMaterial color="#555b63" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh ref={carriage} position={[W.mastPos.x - W.mast.w / 2 - W.carriage.w / 2, 300, W.mastPos.z]}>
        <boxGeometry args={[W.carriage.w, W.carriage.h, W.carriage.d]} />
        <meshStandardMaterial color={COLORS.fanucBlack} />
      </mesh>
      <mesh ref={film} position={[W.center.x, PALLET_LINE.tor, W.center.z]} visible={false}>
        <cylinderGeometry args={[820, 820, 1000, 32, 1, true]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.35} side={2} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SheetMagazine() {
  const M = STATIONS.sheetMagazine;
  const stack = useRef<Mesh>(null);
  useFrame(() => {
    if (stack.current) {
      const h = Math.max(1, engine.sheetMagazine * SLIP_SHEET.t);
      stack.current.scale.y = h;
      stack.current.position.y = M.platformH + h / 2;
    }
  });
  return (
    <Selectable id={M.id} name={M.name}>
      <ModelOrPrimitive name={M.id}>
        <group position={[M.center.x, 0, M.center.z]}>
          <mesh position={[0, M.platformH - 20, 0]}>
            <boxGeometry args={[M.footprint.x + 100, 40, M.footprint.z + 100]} />
            <meshStandardMaterial {...blue} />
          </mesh>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <group key={`${sx}${sz}`}>
                <mesh position={[sx * (M.footprint.x / 2 - 30), (M.platformH - 40) / 2, sz * (M.footprint.z / 2 - 30)]}>
                  <boxGeometry args={[60, M.platformH - 40, 60]} />
                  <meshStandardMaterial {...blue} />
                </mesh>
                <mesh position={[sx * (M.footprint.x / 2 + M.guidePostSize / 2), M.platformH + M.guidePostH / 2, sz * (M.footprint.z / 2 + M.guidePostSize / 2)]}>
                  <boxGeometry args={[M.guidePostSize, M.guidePostH, M.guidePostSize]} />
                  <meshStandardMaterial color={COLORS.ral1023} />
                </mesh>
              </group>
            )),
          )}
          <mesh ref={stack} position={[0, M.platformH, 0]}>
            <boxGeometry args={[M.footprint.x, 1, M.footprint.z]} />
            <meshStandardMaterial color={COLORS.slipSheet} />
          </mesh>
        </group>
      </ModelOrPrimitive>
    </Selectable>
  );
}

function SheetWasteBin() {
  const B = STATIONS.sheetWasteBin;
  return (
    <Selectable id={B.id} name={B.name}>
      <ModelOrPrimitive name={B.id}>
        <group position={[B.center.x, 0, B.center.z]}>
          <mesh position={[0, B.size.h / 2, 0]}>
            <boxGeometry args={[B.size.w, B.size.h, B.size.d]} />
            <meshStandardMaterial color={COLORS.ral5017} transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 20, 0]}>
            <boxGeometry args={[B.size.w - 40, 40, B.size.d - 40]} />
            <meshStandardMaterial color={COLORS.fanucBlack} />
          </mesh>
        </group>
      </ModelOrPrimitive>
    </Selectable>
  );
}

export function Stations() {
  return (
    <group>
      <Labeler />
      <Vision />
      <PusherAndChute />
      <WrapperDynamic />
      <SheetMagazine />
      <SheetWasteBin />
    </group>
  );
}
