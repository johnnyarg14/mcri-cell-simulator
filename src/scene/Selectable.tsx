import { useEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useSimStore } from '../store/useSimStore';
import { objectRegistry } from './registry';

type Props = {
  id: string;
  name?: string;
  children: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

/** grup selectabil: click → selectare în arbore + highlight; respectă „ascuns” din arbore */
export function Selectable({ id, name, children, position, rotation, scale }: Props) {
  const ref = useRef<Group>(null);
  const hidden = useSimStore((s) => !!s.hidden[id]);
  const select = useSimStore((s) => s.select);
  useEffect(() => {
    if (ref.current) objectRegistry.set(id, ref.current);
    return () => {
      objectRegistry.delete(id);
    };
  }, [id]);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(id);
  };
  return (
    <group ref={ref} name={name ?? id} userData={{ id }} visible={!hidden} position={position} rotation={rotation} scale={scale} onClick={onClick}>
      {children}
    </group>
  );
}
