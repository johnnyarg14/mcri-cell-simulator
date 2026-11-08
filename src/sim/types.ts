import type { Matrix4 } from 'three';

export type ProductKind = 'bucket' | 'sheet' | 'pallet';
export type ProductState = 'onPallet' | 'onConveyor' | 'carried' | 'anim' | 'stored' | 'done';

export type Keyframe = { x: number; y: number; z: number; t: number };

export interface Product {
  id: string;
  kind: ProductKind;
  serial: number;
  /** poziție (mm, coordonate celulă) – centrul bazei produsului */
  x: number;
  y: number;
  z: number;
  yaw: number; // grade
  state: ProductState;
  // pe conveior
  conveyor?: string;
  s?: number;
  blocked?: boolean;
  // pe palet
  palletId?: string;
  layer?: number;
  slot?: number;
  ox?: number; // offset față de centrul paletului
  oz?: number;
  oy?: number;
  // transportat de robot – offset în cadrul TCP
  carryOffset?: [number, number, number];
  carryYaw?: number;
  // animație (tobogan, cădere în container)
  anim?: { frames: Keyframe[]; t0: number; then: ProductState };
  // găleți
  labeled: boolean;
  inspected: boolean;
  reject: boolean;
  tDepal?: number;
  tLabel?: number;
  tInspect?: number;
  tRepal?: number;
  // paleți
  zone?: number;
  moving?: boolean;
  complete?: boolean;
  children?: string[];
  zoneEnterT?: number;
  wrapped?: boolean;
  spin?: number; // rotație pe masa infoliatorului
}

export interface Op {
  id: number;
  resource: string;
  name: string;
  color: string;
  start: number;
  end?: number;
  ref?: string;
}

export type ConveyorMode = 'run' | 'stop' | 'accumulate';

export interface BucketConveyorState {
  id: string;
  speed: number;
  mode: ConveyorMode;
  length: number;
  stops: { id: string; name: string; s: number; kind: 'stop' | 'reject' | 'end'; active: boolean }[];
  photocells: { id: string; name: string; s: number; blocked: boolean }[];
  count: number;
}

export interface PalletLineState {
  speed: number;
  mode: ConveyorMode;
  zones: { id: string; occupant: string | null; name: string; role: string }[];
}

export type RobotTaskKind = 'row' | 'sheetRemove' | 'bucket' | 'sheetPlace';
export interface RobotTask {
  kind: RobotTaskKind;
  productIds: string[];
  pick: Matrix4;
  place: Matrix4;
  palletId?: string;
  layer?: number;
  slots?: number[];
  steps: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  name: string;
  target: 'prePick' | 'pick' | 'prePlace' | 'place' | 'dwell' | 'home';
  duration: number;
  color: string;
  action?: 'grip' | 'release';
}

export interface SequenceResource {
  id: string;
  name: string;
  color: string;
}

export interface SequenceConfig {
  description?: string;
  targetRateBpm: number;
  resources: SequenceResource[];
  robot1: { rowCycle: SequenceStep[]; sheetCycle: SequenceStep[]; waitName: string };
  robot2: { bucketCycle: SequenceStep[]; sheetCycle: SequenceStep[]; waitName: string };
  stations: {
    labeler: { name: string; duration: number };
    vision: { name: string; duration: number; rejectEvery: number };
    wrapper: { name: string; duration: number };
    palletInfeedDelay: number;
  };
}

export interface RobotSnapshot {
  id: string;
  q: number[];
  tcp: { x: number; y: number; z: number; w: number; p: number; r: number };
  state: string;
  currentOp: string | null;
  collision: string | null;
  carrying: number;
  manual: boolean;
  ikInfo: string;
  programRunning: boolean;
  programIdx: number;
  programCycles: number;
}

export interface Snapshot {
  t: number;
  tick: number;
  produced: number;
  rejected: number;
  palletsOut: number;
  rateBpm: number;
  avgBpm: number;
  targetBpm: number;
  robots: RobotSnapshot[];
  conveyors: BucketConveyorState[];
  palletLine: PalletLineState;
  stations: {
    labeler: { busy: boolean; count: number; bucket: string | null };
    vision: { busy: boolean; inspected: number; rejected: number; bucket: string | null };
    wrapper: { busy: boolean; progress: number; count: number };
    sheetMagazine: number;
    sheetBin: number;
    rejectBin: number;
  };
  productsVersion: number;
  bodies: number;
  messages: string[];
  mode: 'auto' | 'manual';
}

// ---------------------------------------------------------------- mod manual / programe robot
export type ProgramStepKind = 'move' | 'grip' | 'release' | 'wait';
export interface ProgramStep {
  id: string;
  kind: ProgramStepKind;
  name: string;
  q?: number[]; // pentru 'move' (grade)
  speed?: number; // % din viteza de catalog (move)
  dwell?: number; // secunde (wait / grip / release)
}
export interface RobotProgram {
  steps: ProgramStep[];
  loop: boolean;
  speed: number; // % global
}
export interface ProgramRun {
  running: boolean;
  idx: number;
  t0: number;
  cycles: number;
}
