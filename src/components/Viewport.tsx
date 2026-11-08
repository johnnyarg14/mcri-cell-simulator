import { Canvas } from '@react-three/fiber';
import { CellScene } from '../scene/CellScene';
import { useSimStore } from '../store/useSimStore';
import type { CameraPresetId } from '../config/cell.config';
import { useModelStore } from '../store/useModelStore';

export function Viewport() {
  const { wireframe, showCollisions, showReach, showGrid, setFlag, requestView, viewRequest } = useSimStore();
  const views: { id: CameraPresetId; label: string }[] = [
    { id: 'iso', label: 'Iso' },
    { id: 'top', label: 'Sus' },
    { id: 'front', label: 'Față' },
    { id: 'side', label: 'Lateral' },
  ];
  const addModel = useModelStore((s) => s.add);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(glb|gltf)$/i.test(f.name));
    if (files.length === 0) {
      useSimStore.getState().setStatus('Acceptă doar fișiere .glb / .gltf');
      return;
    }
    for (const f of files) await addModel(f, 'CUSTOM');
    useSimStore.getState().setRightTab('models');
    useSimStore.getState().setStatus(`${files.length} model(e) importat(e) – plasare liberă; ajustează poziția în tabul Modele CAD`);
  };
  return (
    <div className="flex-1 relative min-w-0 bg-[#15171b]" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        camera={{ position: [11, 9, 14], fov: 42, near: 0.05, far: 400 }}
        onPointerMissed={() => useSimStore.getState().select(null)}
      >
        <CellScene />
      </Canvas>
      {/* bara de unelte a viewport-ului */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-ps-panel/85 backdrop-blur rounded border border-ps-border p-1">
        {views.map((v) => (
          <button key={v.id} className={`ps-btn ${viewRequest.preset === v.id ? 'ps-btn-active' : ''}`} onClick={() => requestView(v.id)}>
            {v.label}
          </button>
        ))}
        <span className="w-px h-5 bg-ps-border mx-1" />
        <button className={`ps-btn ${wireframe ? 'ps-btn-active' : ''}`} onClick={() => setFlag('wireframe', !wireframe)} title="Wireframe">
          ▦ Wire
        </button>
        <button className={`ps-btn ${showCollisions ? 'ps-btn-active' : ''}`} onClick={() => setFlag('showCollisions', !showCollisions)} title="Detecție coliziuni gripper ↔ scenă">
          ⚠ Colizii
        </button>
        <button className={`ps-btn ${showReach ? 'ps-btn-active' : ''}`} onClick={() => setFlag('showReach', !showReach)} title="Anvelopa de lucru a roboților">
          ◯ Reach
        </button>
        <button className={`ps-btn ${showGrid ? 'ps-btn-active' : ''}`} onClick={() => setFlag('showGrid', !showGrid)} title="Grilă pardoseală 1 m">
          # Grilă
        </button>
      </div>
      <div className="absolute bottom-2 left-2 text-[10px] text-ps-muted bg-ps-panel/70 rounded px-2 py-1 pointer-events-none">
        Rotire: click stânga · Pan: click dreapta · Zoom: scroll · Click pe obiect = selectare
      </div>
    </div>
  );
}
