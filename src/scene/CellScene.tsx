import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid, GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Box3, Box3Helper, Color, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { CAMERA_PRESETS, COLORS, FLOOR, ROBOTS, SIM } from '../config/cell.config';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import { downloadPNG } from '../utils/export';
import { Fence } from './Fence';
import { PalletLine } from './PalletLine';
import { BucketConveyors } from './BucketConveyors';
import { Robot } from './Robot';
import { Stations } from './Stations';
import { Safety } from './Safety';
import { Products } from './Products';
import { objectRegistry } from './registry';
import { CustomModels } from './ModelOrPrimitive';
import { Selectable } from './Selectable';
import { useModelStore } from '../store/useModelStore';

const S = 0.001; // mm → m

/** bucla de simulare: pași ficși, independent de FPS */
function SimLoop() {
  const acc = useRef(0);
  const lastRefresh = useRef(0);
  const frames = useRef(0);
  const fpsT = useRef(0);
  const { scene } = useThree();
  useFrame((_, delta) => {
    const { playing, speed, refresh, setFps } = useSimStore.getState();
    if (playing) {
      acc.current += Math.min(delta, 0.1) * speed;
      let n = 0;
      while (acc.current >= SIM.dt && n < 500) {
        engine.step();
        acc.current -= SIM.dt;
        n++;
      }
    }
    const now = performance.now();
    frames.current++;
    if (now - fpsT.current > 500) {
      setFps(Math.round((frames.current * 1000) / (now - fpsT.current)));
      frames.current = 0;
      fpsT.current = now;
      let bodies = 0;
      scene.traverse((o) => {
        if ((o as Mesh).isMesh) bodies++;
      });
      engine.bodiesCount = bodies;
    }
    if (now - lastRefresh.current > 100) {
      lastRefresh.current = now;
      refresh();
    }
  });
  return null;
}

/** vederi presetate */
function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const req = useSimStore((s) => s.viewRequest);
  useEffect(() => {
    const p = CAMERA_PRESETS[req.preset];
    camera.position.set(p.position[0] * S, p.position[1] * S, p.position[2] * S);
    if (controls.current) {
      controls.current.target.set(p.target[0] * S, p.target[1] * S, p.target[2] * S);
      controls.current.update();
    }
  }, [req, camera]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.01} minDistance={1} maxDistance={80} />;
}

/** captură PNG a viewport-ului */
function Capture() {
  const req = useSimStore((s) => s.captureRequest);
  const last = useRef(0);
  const { gl, scene, camera } = useThree();
  useFrame(() => {
    if (req !== last.current) {
      last.current = req;
      gl.render(scene, camera);
      downloadPNG(gl.domElement.toDataURL('image/png'));
      useSimStore.getState().setStatus('Captură PNG salvată');
    }
  }, 1);
  return null;
}

/** wireframe global */
function WireframeEffect() {
  const wf = useSimStore((s) => s.wireframe);
  const version = useSimStore((s) => s.productsVersion);
  const { scene } = useThree();
  useEffect(() => {
    scene.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) if ('wireframe' in mm) mm.wireframe = wf;
    });
  }, [wf, version, scene]);
  return null;
}

/** evidențierea obiectului selectat + a corpului în coliziune */
function Highlights() {
  const selectedId = useSimStore((s) => s.selectedId);
  const showCollisions = useSimStore((s) => s.showCollisions);
  const selBox = useRef(new Box3());
  const selHelper = useRef<Box3Helper>(null);
  const colBox = useRef(new Box3());
  const colHelper = useRef<Box3Helper>(null);
  const target = useRef<Object3D | null>(null);
  useEffect(() => {
    target.current = selectedId ? (objectRegistry.get(selectedId) ?? null) : null;
  }, [selectedId]);
  useFrame(() => {
    if (selHelper.current) {
      const o = selectedId ? objectRegistry.get(selectedId) : null;
      if (o && o.visible) {
        selBox.current.setFromObject(o);
        selBox.current.expandByScalar(0.03);
        selHelper.current.visible = !selBox.current.isEmpty();
      } else selHelper.current.visible = false;
    }
    if (colHelper.current) {
      const r = Object.values(engine.robots).find((r) => r.collisionBodyId);
      const body = r ? engine.staticBodies.find((b) => b.id === r.collisionBodyId) : null;
      if (body && showCollisions) {
        colBox.current.min.set(body.min[0] * S, body.min[1] * S, body.min[2] * S);
        colBox.current.max.set(body.max[0] * S, body.max[1] * S, body.max[2] * S);
        colHelper.current.visible = true;
      } else colHelper.current.visible = false;
    }
  });
  return (
    <>
      <box3Helper ref={selHelper} args={[selBox.current, new Color(COLORS.selection)]} />
      <box3Helper ref={colHelper} args={[colBox.current, new Color(COLORS.collision)]} />
    </>
  );
}

export function CellScene() {
  const showGrid = useSimStore((s) => s.showGrid);
  const loadModels = useModelStore((s) => s.load);
  useEffect(() => {
    loadModels();
  }, [loadModels]);
  const select = useSimStore((s) => s.select);
  const fw = (FLOOR.x1 - FLOOR.x0) * S;
  const fd = (FLOOR.z1 - FLOOR.z0) * S;
  const fcx = ((FLOOR.x0 + FLOOR.x1) / 2) * S;
  const fcz = ((FLOOR.z0 + FLOOR.z1) / 2) * S;
  return (
    <>
      <color attach="background" args={['#15171b']} />
      <fog attach="fog" args={['#15171b', 45, 120]} />
      <hemisphereLight args={['#cfd8e6', '#2a2c30', 0.7]} />
      <directionalLight
        position={[14, 22, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-10, 12, -8]} intensity={0.5} />
      <SimLoop />
      <CameraRig />
      <Capture />
      <WireframeEffect />
      <Highlights />
      {/* pardoseală */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[fcx, -0.002, fcz]} receiveShadow onClick={() => select(null)}>
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.95} />
      </mesh>
      {showGrid && (
        <Grid
          position={[fcx, 0.001, fcz]}
          args={[fw, fd]}
          cellSize={FLOOR.gridMm * S}
          cellThickness={0.6}
          cellColor="#3d4148"
          sectionSize={FLOOR.gridMm * S * 5}
          sectionThickness={1.2}
          sectionColor="#5a6170"
          fadeDistance={90}
          fadeStrength={1}
        />
      )}
      <axesHelper args={[1.5]} position={[0, 0.002, 0]} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={['#ff5c5c', '#6bdc6b', '#5c8cff']} labelColor="white" />
      </GizmoHelper>
      {/* celula – în mm */}
      <group scale={[S, S, S]}>
        <Fence />
        <PalletLine />
        <BucketConveyors />
        {ROBOTS.map((r) => (
          <Robot key={r.id} cfg={r} />
        ))}
        <Stations />
        <Safety />
        <Products />
        <CustomModels Selectable={Selectable} />
      </group>
    </>
  );
}

export const _v = new Vector3();
