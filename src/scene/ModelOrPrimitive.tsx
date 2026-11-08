import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { MODELS_MANIFEST_URL } from '../config/cell.config';

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

function GLTFModel({ entry }: { entry: ManifestEntry }) {
  const url = import.meta.env.BASE_URL + 'models/' + entry.file;
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
  const entry = manifest[name];
  if (!entry) return <>{children}</>;
  return (
    <Suspense fallback={children}>
      <GLTFModel entry={entry} />
    </Suspense>
  );
}
