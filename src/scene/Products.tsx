import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { BUCKET, COLORS, PALLET, SLIP_SHEET } from '../config/cell.config';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import { objectRegistry } from './registry';
import type { Product } from '../sim/types';

// geometrii/materiale partajate (performanță)
const G = {
  bucket: new CylinderGeometry(BUCKET.dia / 2, BUCKET.bottomDia / 2, BUCKET.h - BUCKET.lidH, 20),
  lid: new CylinderGeometry(BUCKET.lidDia / 2, BUCKET.lidDia / 2, BUCKET.lidH, 20),
  handle: new CylinderGeometry(6, 6, BUCKET.dia + 20, 6),
  label: new PlaneGeometry(130, 90),
  sheet: new BoxGeometry(SLIP_SHEET.w, SLIP_SHEET.t, SLIP_SHEET.l),
  deck: new BoxGeometry(PALLET.w, PALLET.deckT, 140),
  stringer: new BoxGeometry(PALLET.w, PALLET.deckT, PALLET.l),
  block: new BoxGeometry(PALLET.blockW, PALLET.h - 2 * PALLET.deckT, PALLET.blockW),
};
const M = {
  bucket: new MeshStandardMaterial({ color: COLORS.bucket, roughness: 0.55 }),
  bucketReject: new MeshStandardMaterial({ color: '#f0a0a0', roughness: 0.55 }),
  lid: new MeshStandardMaterial({ color: COLORS.bucketLid, roughness: 0.5 }),
  handle: new MeshStandardMaterial({ color: '#777', metalness: 0.7 }),
  label: new MeshStandardMaterial({ color: COLORS.label, roughness: 0.9 }),
  sheet: new MeshStandardMaterial({ color: COLORS.slipSheet, roughness: 0.9 }),
  wood: new MeshStandardMaterial({ color: COLORS.pallet, roughness: 0.9 }),
};

function useProductTransform(id: string, ref: React.RefObject<Group | null>, onFrame?: (p: Product) => void) {
  useFrame(() => {
    const g = ref.current;
    const p = engine.products.get(id);
    if (!g) return;
    if (!p) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = (p.yaw * Math.PI) / 180;
    onFrame?.(p);
  });
}

function useRegister(id: string, ref: React.RefObject<Group | null>) {
  useEffect(() => {
    if (ref.current) objectRegistry.set(id, ref.current);
    return () => {
      objectRegistry.delete(id);
    };
  }, [id, ref]);
}

function Bucket({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const label = useRef<Mesh>(null);
  const select = useSimStore((s) => s.select);
  useRegister(id, ref);
  useProductTransform(id, ref, (p) => {
    if (body.current) body.current.material = p.reject ? M.bucketReject : M.bucket;
    if (label.current) label.current.visible = p.labeled;
  });
  return (
    <group
      ref={ref}
      userData={{ id }}
      onClick={(e) => {
        e.stopPropagation();
        select(id);
      }}
    >
      <mesh ref={body} geometry={G.bucket} material={M.bucket} position={[0, (BUCKET.h - BUCKET.lidH) / 2, 0]} castShadow />
      <mesh geometry={G.lid} material={M.lid} position={[0, BUCKET.h - BUCKET.lidH / 2, 0]} />
      <mesh geometry={G.handle} material={M.handle} position={[0, BUCKET.h - 30, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh ref={label} geometry={G.label} material={M.label} position={[0, BUCKET.h / 2, BUCKET.dia / 2 - 4]} visible={false} />
    </group>
  );
}

function Sheet({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const select = useSimStore((s) => s.select);
  useRegister(id, ref);
  useProductTransform(id, ref);
  return (
    <group
      ref={ref}
      userData={{ id }}
      onClick={(e) => {
        e.stopPropagation();
        select(id);
      }}
    >
      <mesh geometry={G.sheet} material={M.sheet} position={[0, SLIP_SHEET.t / 2, 0]} />
    </group>
  );
}

function Pallet({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const select = useSimStore((s) => s.select);
  useRegister(id, ref);
  useProductTransform(id, ref);
  const boards = useMemo(() => [-PALLET.l / 2 + 80, -PALLET.l / 4, 0, PALLET.l / 4, PALLET.l / 2 - 80], []);
  return (
    <group
      ref={ref}
      userData={{ id }}
      onClick={(e) => {
        e.stopPropagation();
        select(id);
      }}
    >
      {boards.map((z) => (
        <mesh key={z} geometry={G.deck} material={M.wood} position={[0, PALLET.h - PALLET.deckT / 2, z]} castShadow />
      ))}
      {[-PALLET.w / 2 + 70, 0, PALLET.w / 2 - 70].map((x) => (
        <mesh key={x} geometry={G.stringer} material={M.wood} position={[x, PALLET.deckT / 2, 0]} scale={[0.14, 1, 1]} />
      ))}
      {[-PALLET.w / 2 + 70, 0, PALLET.w / 2 - 70].map((x) =>
        [-PALLET.l / 2 + 70, 0, PALLET.l / 2 - 70].map((z) => (
          <mesh key={`${x}${z}`} geometry={G.block} material={M.wood} position={[x, PALLET.h / 2, z]} />
        )),
      )}
    </group>
  );
}

/** toate produsele din motor; lista se reîmprospătează când motorul semnalează spawn/despawn */
export function Products() {
  const version = useSimStore((s) => s.productsVersion);
  const hidden = useSimStore((s) => s.hidden);
  const ids = useMemo(() => {
    void version;
    return [...engine.products.values()].map((p) => ({ id: p.id, kind: p.kind }));
  }, [version]);
  return (
    <group>
      <group visible={!hidden.PRODUCTS_BUCKETS}>{ids.filter((p) => p.kind === 'bucket').map((p) => <Bucket key={p.id} id={p.id} />)}</group>
      <group visible={!hidden.PRODUCTS_SHEETS}>{ids.filter((p) => p.kind === 'sheet').map((p) => <Sheet key={p.id} id={p.id} />)}</group>
      <group visible={!hidden.PRODUCTS_PALLETS}>{ids.filter((p) => p.kind === 'pallet').map((p) => <Pallet key={p.id} id={p.id} />)}</group>
    </group>
  );
}
