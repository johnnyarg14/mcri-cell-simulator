import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { MODELS_MANIFEST_URL } from '../config/cell.config';
import { useModelStore } from '../store/useModelStore';

/**
 * Manifestul modelelor glTF: public/models/manifest.json
 * {
 *   "Robot_1": { "file": "Robot_1.glb", "scale": 1, "position": [0,0,0], "rotation": [0,0,0] }
 * }
 * Cheia = numele obiectului din scenă (id-ul din Object Tree). scale 1 = model în mm;
 * pentru modele exportate în metri folosește scale 1000. rotation în grade (X,Y,Z).
 */
export type ManifestEntry = { file: string; scale?: number; position?: [number, number, number]; rotation?: [number, number, number] };
type Manifest = Record<string, ManifestEntry>;

let manifestCache: Manifest | null = null;
let manifestPromise: Promise<Manifest> | null = null;
const listeners = new Set<(m: Manifest) => void>();

export function loadManifest(): Promise<Manifest> {
  if (manifestCache) return Promise.resolve(manifestCache);
  if (!manifestPromise) {
    manifestPromise = fetch(import.meta.env.BASE_URL + MODELS_MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m: Manifest) => {
        manifestCache = m;
        listeners.forEach((l) => l(m));
        return m;
      });
  }
  return manifestPromise;
}

function useManifest(): Manifest {
  const [m, setM] = useState<Manifest>(manifestCache ?? {});
  useEffect(() => {
    listeners.add(setM);
    loadManifest().then(setM);
    return () => {
      listeners.delete(setM);
    };
  }, []);
  return m;
}

export function GLTFModel({ entry, url: directUrl }: { entry: ManifestEntry; url?: string }) {
  const url = directUrl ?? import.meta.env.BASE_URL + 'models/' + entry.file;
  const { scene } = useGLTF(url);
  const s = entry.scale ?? 1;
  const rot = (entry.rotation ?? [0, 0, 0]).map((d) => (d * Math.PI) / 180) as [number, number, number];
  return <primitive object={scene} scale={[s, s, s]} position={entry.position ?? [0, 0, 0]} rotation={rot} />;
}

/**
 * Randează modelul glTF `public/models/<name>.glb` dacă există în manifest,
 * altfel primitivele parametrizate (children).
 */
export function ModelOrPrimitive({ name, children }: { name: string; children: ReactNode }) {
  const manifest = useManifest();
  // 1) model importat la rulare (panoul „Modele CAD”) are prioritate
  const rt = useModelStore((s) => s.models.find((m) => m.objectId === name && m.visible));
  const rtUrl = useModelStore((s) => (rt ? s.urls[rt.id] : undefined));
  if (rt && rtUrl)
    return (
      <Suspense fallback={children}>
        <GLTFModel entry={{ file: rt.fileName, scale: rt.scale, position: rt.position, rotation: rt.rotation }} url={rtUrl} />
      </Suspense>
    );
  // 2) model din public/models (manifest.json)
  const entry = manifest[name];
  if (!entry) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <GLTFModel entry={entry} />
    </Suspense>
  );
}

/** modele importate cu plasare liberă (objectId = 'CUSTOM'), cu ierarhie părinte → copil */
export function CustomModels({ Selectable }: { Selectable: (p: { id: string; name: string; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) => ReactNode }) {
  const all = useModelStore((s) => s.models);
  const urls = useModelStore((s) => s.urls);
  const models = all.filter((m) => m.objectId === 'CUSTOM');
  const D = Math.PI / 180;
  const render = (parentId: string | undefined): ReactNode =>
    models
      .filter((m) => (m.parentId ?? undefined) === parentId && (parentId !== undefined || !m.parentId || !models.some((p) => p.id === m.parentId)))
      .map((m) => (
        <Selectable key={m.id} id={m.id} name={m.name} position={m.position} rotation={[m.rotation[0] * D, m.rotation[1] * D, m.rotation[2] * D]}>
          <group visible={m.visible}>
            {urls[m.id] && (
              <Suspense fallback={null}>
                <GLTFModel entry={{ file: m.fileName, scale: m.scale }} url={urls[m.id]} />
              </Suspense>
            )}
          </group>
          {render(m.id)}
        </Selectable>
      ));
  return <>{render(undefined)}</>;
}
