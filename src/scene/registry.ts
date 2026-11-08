import type { Object3D } from 'three';

/** registru id → Object3D pentru selecție/evidențiere (populat de <Selectable>) */
export const objectRegistry = new Map<string, Object3D>();
