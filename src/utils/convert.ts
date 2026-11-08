/**
 * Conversie în browser a formatelor CAD/mesh uzuale → GLB (fără backend).
 *  - STL / OBJ / PLY / 3MF / DAE (Collada) / FBX → loaderele Three.js → GLTFExporter
 *  - STEP / STP / IGES / IGS / BREP → OpenCascade (WASM, occt-import-js, încărcat la cerere) → GLTFExporter
 */
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Object3D, DoubleSide } from 'three';

export const CONVERTIBLE_EXT = ['glb', 'gltf', 'stl', 'obj', 'ply', '3mf', 'dae', 'fbx', 'step', 'stp', 'iges', 'igs', 'brep', 'brp'];
export const ACCEPT_ATTR = CONVERTIBLE_EXT.map((e) => '.' + e).join(',');

export type ConvertResult = { blob: Blob; fileName: string; info: string; unitScale: number };
export type ProgressFn = (msg: string) => void;

const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();
export const isConvertible = (name: string) => CONVERTIBLE_EXT.includes(extOf(name));

// --------------------------------------------------------------------------- OpenCascade (WASM)
type OcctMesh = {
  name?: string;
  color?: [number, number, number];
  attributes: { position: { array: number[] }; normal?: { array: number[] } };
  index: { array: number[] };
  brep_faces?: { first: number; last: number; color: [number, number, number] | null }[];
};
type OcctNode = { name: string; meshes: number[]; children: OcctNode[] };
type OcctResult = { success: boolean; root: OcctNode; meshes: OcctMesh[] };
type Occt = {
  ReadStepFile(buf: Uint8Array, params: Record<string, unknown> | null): OcctResult;
  ReadIgesFile(buf: Uint8Array, params: Record<string, unknown> | null): OcctResult;
  ReadBrepFile(buf: Uint8Array, params: Record<string, unknown> | null): OcctResult;
};
declare global {
  interface Window {
    occtimportjs?: (opts: { locateFile: (p: string) => string }) => Promise<Occt>;
  }
}
let occtPromise: Promise<Occt> | null = null;
function loadOcct(progress: ProgressFn): Promise<Occt> {
  if (occtPromise) return occtPromise;
  const base = import.meta.env.BASE_URL + 'occt/';
  occtPromise = new Promise<Occt>((resolve, reject) => {
    const boot = () => {
      if (!window.occtimportjs) return reject(new Error('runtime OpenCascade indisponibil'));
      progress('Inițializare OpenCascade (WASM ~7 MB, doar prima dată)…');
      window.occtimportjs({ locateFile: (p) => base + p }).then(resolve, reject);
    };
    if (window.occtimportjs) return boot();
    const s = document.createElement('script');
    s.src = base + 'occt-import-js.js';
    s.onload = boot;
    s.onerror = () => reject(new Error('nu pot încărca occt-import-js.js'));
    document.head.appendChild(s);
  }).catch((e) => {
    occtPromise = null;
    throw e;
  });
  return occtPromise;
}

function occtToObject(res: OcctResult): { obj: Object3D; tris: number; parts: number } {
  const geoms = res.meshes.map((m) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(m.attributes.position.array), 3));
    if (m.attributes.normal) g.setAttribute('normal', new BufferAttribute(new Float32Array(m.attributes.normal.array), 3));
    else g.computeVertexNormals();
    const idx = m.index.array;
    g.setIndex(new BufferAttribute(idx.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    return g;
  });
  let tris = 0;
  const matCache = new Map<string, MeshStandardMaterial>();
  const matFor = (c?: [number, number, number] | null) => {
    const key = c ? c.join(',') : 'default';
    let m = matCache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({ color: c ? new Color(c[0], c[1], c[2]) : new Color('#9aa0a6'), metalness: 0.2, roughness: 0.6 });
      matCache.set(key, m);
    }
    return m;
  };
  const build = (n: OcctNode): Object3D => {
    const g = new Group();
    g.name = n.name || 'node';
    for (const mi of n.meshes) {
      const m = res.meshes[mi];
      const geo = geoms[mi];
      tris += geo.index ? geo.index.count / 3 : 0;
      // culori per față b-rep → grupuri de material
      const faces = (m.brep_faces ?? []).filter((f) => f.color);
      let mesh: Mesh;
      if (faces.length > 0) {
        const mats: MeshStandardMaterial[] = [];
        for (const f of m.brep_faces!) {
          const mat = matFor(f.color ?? m.color ?? null);
          let gi = mats.indexOf(mat);
          if (gi < 0) {
            mats.push(mat);
            gi = mats.length - 1;
          }
          geo.addGroup(f.first * 3, (f.last - f.first + 1) * 3, gi);
        }
        mesh = new Mesh(geo, mats);
      } else mesh = new Mesh(geo, matFor(m.color ?? null));
      mesh.name = m.name || `mesh_${mi}`;
      mesh.castShadow = true;
      g.add(mesh);
    }
    for (const c of n.children) g.add(build(c));
    return g;
  };
  const obj = build(res.root);
  return { obj, tris, parts: res.meshes.length };
}

// --------------------------------------------------------------------------- loadere Three.js
async function loadMesh(file: File, ext: string, progress: ProgressFn): Promise<Object3D> {
  const buf = await file.arrayBuffer();
  const text = () => new TextDecoder().decode(buf);
  const defaultMat = () => new MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.2, roughness: 0.6, side: DoubleSide });
  progress(`Citire ${ext.toUpperCase()}…`);
  switch (ext) {
    case 'stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const geo = new STLLoader().parse(buf);
      if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
      const mat = defaultMat();
      if (geo.hasAttribute('color')) mat.vertexColors = true;
      return new Mesh(geo, mat);
    }
    case 'obj': {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const obj = new OBJLoader().parse(text());
      obj.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.material = defaultMat();
      });
      return obj;
    }
    case 'ply': {
      const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
      const geo = new PLYLoader().parse(buf);
      if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
      const mat = defaultMat();
      if (geo.hasAttribute('color')) mat.vertexColors = true;
      return new Mesh(geo, mat);
    }
    case '3mf': {
      const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
      return new ThreeMFLoader().parse(buf);
    }
    case 'dae': {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const dae = new ColladaLoader().parse(text(), '') as { scene?: Object3D } | null;
      if (!dae?.scene) throw new Error('fișier Collada fără scenă');
      return dae.scene;
    }
    case 'fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      return new FBXLoader().parse(buf, '');
    }
  }
  throw new Error(`format neacceptat: .${ext}`);
}

async function exportGLB(obj: Object3D): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  obj.updateMatrixWorld(true);
  const out = await new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: false });
  return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
}

function countTris(obj: Object3D): number {
  let n = 0;
  obj.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.geometry) n += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  return Math.round(n);
}

/**
 * Convertește orice format acceptat în GLB. Returnează și `unitScale` sugerat:
 * STEP/IGES ies în mm (1); STL/OBJ nu au unități – presupunem mm (1), utilizatorul poate schimba scara.
 */
export async function convertToGLB(file: File, progress: ProgressFn = () => undefined, opts: { deflection?: number } = {}): Promise<ConvertResult> {
  const ext = extOf(file.name);
  const base = file.name.replace(/\.[^.]+$/, '');
  if (ext === 'glb' || ext === 'gltf') return { blob: file, fileName: file.name, info: 'glTF nativ', unitScale: 1 };
  if (['step', 'stp', 'iges', 'igs', 'brep', 'brp'].includes(ext)) {
    progress('Încărcare OpenCascade…');
    const occt = await loadOcct(progress);
    progress(`Triangulare ${ext.toUpperCase()} (${(file.size / 1024).toFixed(0)} kB)…`);
    const buf = new Uint8Array(await file.arrayBuffer());
    const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: opts.deflection ?? 0.001, angularDeflection: 0.5 };
    const res = ext.startsWith('st') ? occt.ReadStepFile(buf, params) : ext.startsWith('ig') ? occt.ReadIgesFile(buf, params) : occt.ReadBrepFile(buf, params);
    if (!res.success || res.meshes.length === 0) throw new Error(`OpenCascade nu a putut citi ${file.name}`);
    const { obj, tris, parts } = occtToObject(res);
    progress('Export GLB…');
    const blob = await exportGLB(obj);
    return { blob, fileName: base + '.glb', info: `${ext.toUpperCase()} → GLB: ${parts} corpuri, ${tris} triunghiuri, ${(blob.size / 1024).toFixed(0)} kB`, unitScale: 1 };
  }
  const obj = await loadMesh(file, ext, progress);
  progress('Export GLB…');
  const blob = await exportGLB(obj);
  return { blob, fileName: base + '.glb', info: `${ext.toUpperCase()} → GLB: ${countTris(obj)} triunghiuri, ${(blob.size / 1024).toFixed(0)} kB`, unitScale: 1 };
}
