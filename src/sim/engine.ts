/**
 * Motorul de simulare – pași de timp ficși (SIM.dt), independent de FPS.
 * Toată starea este mutabilă și citită direct de scenă (useFrame); UI-ul primește
 * instantanee (snapshot) la ~10 Hz.
 */
import { Matrix4, Vector3 } from 'three';
import {
  BUCKET,
  BUCKET_LINE,
  MOTION,
  PALLET,
  PALLET_LINE,
  PATTERN,
  ROBOTS,
  SIM,
  SLIP_SHEET,
  STATIONS,
  type RobotConfig,
} from '../config/cell.config';
import defaultSequence from '../config/sequence.json';
import { forwardKinematics, toolPoseDown, toWPR, type FKResult } from '../kinematics/fk';
import { solveIKRobust } from '../kinematics/ik';
import { buildPaths, type ConveyorPath } from './conveyor';
import { aabbOverlap, buildStaticBodies, toolAABB, type AABB } from './collision';
import type {
  BucketConveyorState,
  Op,
  PalletLineState,
  Product,
  RobotTask,
  SequenceConfig,
  SequenceStep,
  Snapshot,
} from './types';

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const palletTopY = PALLET_LINE.tor + PALLET.h;
const layerPitch = BUCKET.h + (SLIP_SHEET.t as number);
const bucketBottomY = (layer: number) => palletTopY + layer * layerPitch;
const sheetBottomY = (layer: number) => palletTopY + (layer + 1) * BUCKET.h + layer * SLIP_SHEET.t; // foaia de deasupra nivelului `layer`

export interface RobotRuntime {
  cfg: RobotConfig;
  q: number[];
  fk: FKResult;
  tcp: Vector3;
  motion: { q0: number[]; q1: number[]; t0: number; dur: number } | null;
  task: RobotTask | null;
  stepIdx: number;
  stepT0: number;
  carried: string[];
  state: string;
  currentOp: Op | null;
  waitOp: Op | null;
  collision: string | null;
  collisionBodyId: string | null;
  manual: boolean;
  ikInfo: string;
  toolBox: { min: number[]; max: number[] };
  teach: { name: string; q: number[] }[];
}

type Listener = () => void;

export class Engine {
  t = 0;
  tick = 0;
  sequence: SequenceConfig = defaultSequence as SequenceConfig;
  products = new Map<string, Product>();
  productsVersion = 0;
  ops: Op[] = [];
  private opId = 1;
  messages: string[] = [];
  paths: Record<string, ConveyorPath> = buildPaths(BUCKET_LINE.conveyors);
  conveyors: Record<string, BucketConveyorState> = {};
  palletLine!: PalletLineState;
  robots: Record<string, RobotRuntime> = {};
  staticBodies: AABB[] = buildStaticBodies();
  collisionEnabled = true;
  // stații
  labeler = { busy: false, bucket: null as string | null, tEnd: 0, count: 0, op: null as Op | null, releaseUntilPassed: null as string | null };
  vision = { busy: false, bucket: null as string | null, tEnd: 0, inspected: 0, rejected: 0, op: null as Op | null, releaseUntilPassed: null as string | null, flash: 0 };
  pusher = { phase: 'idle' as 'idle' | 'extend' | 'retract', t0: 0, bucket: null as string | null, ext: 0 };
  wrapper = { busy: false, pallet: null as string | null, t0: 0, count: 0, op: null as Op | null, progress: 0, carriageY: 0 };
  sheetMagazine = STATIONS.sheetMagazine.sheetCount;
  sheetBin = 0;
  rejectBin = 0;
  // metrici
  produced = 0;
  palletsOut = 0;
  placeTimes: number[] = [];
  private serial = 0;
  private serials: Record<string, number> = { PAL: 0, BKT: 0, SHT: 0 };
  private infeedTimer = 0;
  /** înregistrări de ciclu arhivate pentru găleți care au părăsit celula */
  private archive: { id: string; serial: number; tDepal?: number; tLabel?: number; tInspect?: number; tRepal?: number; reject: boolean }[] = [];
  private listeners = new Set<Listener>();
  bodiesCount = 0;

  constructor() {
    this.reset();
  }

  // ---------------------------------------------------------------- lifecycle
  onChange(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private notify() {
    this.productsVersion++;
    for (const l of this.listeners) l();
  }

  setSequence(seq: SequenceConfig) {
    this.sequence = seq;
    this.reset();
  }

  reset() {
    this.t = 0;
    this.tick = 0;
    this.products.clear();
    this.ops = [];
    this.opId = 1;
    this.messages = [];
    this.produced = 0;
    this.palletsOut = 0;
    this.placeTimes = [];
    this.serial = 0;
    this.serials = { PAL: 0, BKT: 0, SHT: 0 };
    this.archive = [];
    this.sheetMagazine = STATIONS.sheetMagazine.sheetCount;
    this.sheetBin = 0;
    this.rejectBin = 0;
    this.infeedTimer = 0;
    this.labeler = { busy: false, bucket: null, tEnd: 0, count: 0, op: null, releaseUntilPassed: null };
    this.vision = { busy: false, bucket: null, tEnd: 0, inspected: 0, rejected: 0, op: null, releaseUntilPassed: null, flash: 0 };
    this.pusher = { phase: 'idle', t0: 0, bucket: null, ext: 0 };
    this.wrapper = { busy: false, pallet: null, t0: 0, count: 0, op: null, progress: 0, carriageY: 0 };
    // conveioare găleți
    this.conveyors = {};
    for (const c of BUCKET_LINE.conveyors) {
      this.conveyors[c.id] = {
        id: c.id,
        speed: BUCKET_LINE.speed,
        mode: 'run',
        length: this.paths[c.id].length,
        stops: c.stops.map((s) => ({ ...s, active: s.kind !== 'reject' })),
        photocells: c.photocells.map((p) => ({ ...p, blocked: false })),
        count: 0,
      };
    }
    this.palletLine = {
      speed: PALLET_LINE.speed,
      mode: 'run',
      zones: PALLET_LINE.zones.map((z) => ({ id: z.id, name: z.name, role: z.role, occupant: null })),
    };
    // roboți
    for (const cfg of ROBOTS) {
      const prev = this.robots[cfg.id];
      const q = cfg.home.slice();
      const fk = forwardKinematics(cfg, q);
      this.robots[cfg.id] = {
        cfg,
        q,
        fk,
        tcp: new Vector3().setFromMatrixPosition(fk.tcp),
        motion: null,
        task: null,
        stepIdx: 0,
        stepT0: 0,
        carried: [],
        state: 'IDLE',
        currentOp: null,
        waitOp: null,
        collision: null,
        collisionBodyId: null,
        manual: false,
        ikInfo: '',
        toolBox: { min: [0, 0, 0], max: [0, 0, 0] },
        teach: prev?.teach ?? [],
      };
    }
    // stare inițială: palet plin la depal (S3) și la intrare (S1), palet gol la repal (S7)
    const zi = (role: string) => PALLET_LINE.zones.findIndex((z) => z.role === role);
    this.spawnPallet(zi('depal'), true);
    this.spawnPallet(zi('infeed'), true);
    this.spawnPallet(zi('repal'), false);
    this.notify();
  }

  // ---------------------------------------------------------------- utilitare
  private newId(kind: string) {
    this.serial++;
    this.serials[kind] = (this.serials[kind] ?? 0) + 1;
    return `${kind}_${this.serials[kind]}`;
  }
  private serialOf(id: string) {
    return Number(id.split('_')[1]);
  }
  private zoneCenter(i: number) {
    const z = PALLET_LINE.zones[i];
    return (z.z0 + z.z1) / 2;
  }
  private beginOp(resource: string, name: string, color: string, ref?: string): Op {
    const op: Op = { id: this.opId++, resource, name, color, start: this.t, ref };
    this.ops.push(op);
    if (this.ops.length > SIM.maxOpsLog) this.ops.splice(0, this.ops.length - SIM.maxOpsLog);
    return op;
  }
  private endOp(op: Op | null) {
    if (op && op.end === undefined) op.end = this.t;
  }
  message(m: string) {
    this.messages.push(`[${this.fmtTime()}] ${m}`);
    if (this.messages.length > 200) this.messages.shift();
  }
  fmtTime(t = this.t) {
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    const d = Math.floor((t * 10) % 10);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
  }

  private spawnPallet(zoneIdx: number, full: boolean) {
    const id = this.newId('PAL');
    const p: Product = {
      id,
      kind: 'pallet',
      serial: this.serialOf(id),
      x: PALLET_LINE.x,
      y: PALLET_LINE.tor,
      z: this.zoneCenter(zoneIdx),
      yaw: 0,
      state: 'onConveyor',
      zone: zoneIdx,
      moving: false,
      complete: false,
      children: [],
      labeled: false,
      inspected: false,
      reject: false,
      zoneEnterT: this.t,
      spin: 0,
    };
    this.products.set(id, p);
    this.palletLine.zones[zoneIdx].occupant = id;
    if (full) {
      PATTERN.layers.forEach((rows, L) => {
        rows.forEach((row, r) => {
          row.forEach((slot, k) => {
            const bid = this.newId('BKT');
            const b: Product = {
              id: bid,
              kind: 'bucket',
              serial: this.serialOf(bid),
              x: p.x + slot.x,
              y: bucketBottomY(L),
              z: p.z + slot.z,
              yaw: 0,
              state: 'onPallet',
              palletId: id,
              layer: L,
              slot: r * row.length + k,
              ox: slot.x,
              oz: slot.z,
              oy: bucketBottomY(L) - p.y,
              labeled: false,
              inspected: false,
              reject: false,
            };
            this.products.set(b.id, b);
            p.children!.push(b.id);
          });
        });
        if (L < PATTERN.layers.length - 1) {
          const sid = this.newId('SHT');
          const sh: Product = {
            id: sid,
            kind: 'sheet',
            serial: this.serialOf(sid),
            x: p.x,
            y: sheetBottomY(L),
            z: p.z,
            yaw: 0,
            state: 'onPallet',
            palletId: id,
            layer: L,
            ox: 0,
            oz: 0,
            oy: sheetBottomY(L) - p.y,
            labeled: false,
            inspected: false,
            reject: false,
          };
          this.products.set(sh.id, sh);
          p.children!.push(sh.id);
        }
      });
    }
    this.notify();
    return p;
  }

  // ---------------------------------------------------------------- control
  /** avansează simularea cu `seconds` secunde de timp simulat (în pași ficși) */
  advance(seconds: number) {
    const n = Math.round(seconds / SIM.dt);
    for (let i = 0; i < n; i++) this.step();
  }

  /** sare (determinist) la momentul t: reset + re-simulare */
  jumpTo(t: number) {
    const teach = Object.fromEntries(Object.values(this.robots).map((r) => [r.cfg.id, r.teach]));
    this.reset();
    for (const r of Object.values(this.robots)) r.teach = teach[r.cfg.id] ?? [];
    const n = Math.max(0, Math.floor(t / SIM.dt));
    for (let i = 0; i < n; i++) this.step();
    this.notify();
  }

  setJoint(robotId: string, idx: number, deg: number) {
    const r = this.robots[robotId];
    if (!r) return;
    const j = r.cfg.joints[idx];
    r.q[idx] = Math.max(j.min, Math.min(j.max, deg));
    r.manual = true;
    r.motion = null;
    this.updateRobotFK(r);
  }

  /** IK către o poziție-țintă TCP (matrice în coordonate celulă) */
  jogTo(robotId: string, target: Matrix4): boolean {
    const r = this.robots[robotId];
    if (!r) return false;
    const res = solveIKRobust(r.cfg, target, r.q);
    r.q = res.q.slice();
    r.manual = true;
    r.motion = null;
    r.ikInfo = res.converged
      ? `IK convergent în ${res.iterations} iterații (ε=${res.posErr.toFixed(2)} mm, ${res.rotErr.toFixed(2)}°)`
      : `IK NEconvergent – țintă în afara spațiului de lucru (ε=${res.posErr.toFixed(0)} mm)`;
    if (!res.converged) this.message(`${r.cfg.name}: țintă inaccesibilă (eroare ${res.posErr.toFixed(0)} mm)`);
    this.updateRobotFK(r);
    return res.converged;
  }

  teachCurrent(robotId: string, name: string) {
    const r = this.robots[robotId];
    if (!r) return;
    r.teach.push({ name, q: r.q.slice() });
  }

  setConveyorSpeed(id: string, speed: number) {
    const c = this.conveyors[id];
    if (c) c.speed = speed;
  }
  setConveyorMode(id: string, mode: 'run' | 'stop' | 'accumulate') {
    const c = this.conveyors[id];
    if (c) c.mode = mode;
  }
  setPalletLineMode(mode: 'run' | 'stop' | 'accumulate') {
    this.palletLine.mode = mode;
  }
  setPalletLineSpeed(v: number) {
    this.palletLine.speed = v;
  }

  // ---------------------------------------------------------------- pasul de simulare
  step() {
    const dt = SIM.dt;
    this.stepPalletLine(dt);
    this.stepBucketConveyors(dt);
    this.stepStations(dt);
    this.stepRobot(this.robots.ROBOT_1, dt);
    this.stepRobot(this.robots.ROBOT_2, dt);
    this.stepAnimations();
    this.t += dt;
    this.tick++;
  }

  // ---------- linia de paleți -------------------------------------------------
  private stepPalletLine(dt: number) {
    const PL = this.palletLine;
    const zones = PALLET_LINE.zones;
    // apariție palet plin la intrare
    const inIdx = zones.findIndex((z) => z.role === 'infeed');
    if (PL.zones[inIdx].occupant === null) {
      this.infeedTimer += dt;
      if (this.infeedTimer >= this.sequence.stations.palletInfeedDelay) {
        this.infeedTimer = 0;
        const p = this.spawnPallet(inIdx, true);
        this.endOp(this.beginOp('PALLET_LINE', `Palet ${p.serial} încărcat (stivuitor)`, '#4f8de6', p.id));
      }
    }
    const pallets = [...this.products.values()].filter((p) => p.kind === 'pallet' && p.state === 'onConveyor');
    const speed = PL.mode === 'stop' ? 0 : PL.speed;
    for (const p of pallets) {
      const zi = p.zone!;
      const zone = zones[zi];
      if (p.moving) {
        const target = this.zoneCenter(zi + 1);
        p.z = Math.min(target, p.z + speed * dt);
        if (p.z >= target - 1e-6) {
          p.z = target;
          p.moving = false;
          PL.zones[zi].occupant = null;
          p.zone = zi + 1;
          p.zoneEnterT = this.t;
          const nz = zones[zi + 1];
          if (nz.role === 'exit') this.message(`Barieră optică ieșire: trecere palet ${p.serial}`);
        }
        this.updatePalletChildren(p);
        continue;
      }
      // palet oprit în zonă: verifică eliberarea
      let release = false;
      switch (zone.role) {
        case 'infeed':
        case 'buffer':
        case 'transfer':
        case 'exit':
          release = true;
          break;
        case 'depal':
          release = p.children!.length === 0 && !this.robots.ROBOT_1.task;
          break;
        case 'repal':
          release = !!p.complete && !this.robots.ROBOT_2.task;
          break;
        case 'wrapper': {
          const W = this.wrapper;
          if (!W.busy && !p.wrapped) {
            W.busy = true;
            W.pallet = p.id;
            W.t0 = this.t;
            W.op = this.beginOp('EQ_WRAPPER', this.sequence.stations.wrapper.name, '#56b6c2', p.id);
          }
          if (W.busy && W.pallet === p.id) {
            const dur = this.sequence.stations.wrapper.duration;
            W.progress = Math.min(1, (this.t - W.t0) / dur);
            p.spin = (p.spin ?? 0) + STATIONS.wrapper.rpm * 6 * dt; // grade
            W.carriageY = 300 + (Math.sin(W.progress * Math.PI * 3 - Math.PI / 2) * 0.5 + 0.5) * 1400;
            if (W.progress >= 1) {
              W.busy = false;
              W.count++;
              W.pallet = null;
              this.endOp(W.op);
              p.wrapped = true;
              p.spin = 0;
            }
            this.updatePalletChildren(p);
          }
          release = !!p.wrapped;
          break;
        }
        case 'outfeed':
          if (this.t - (p.zoneEnterT ?? 0) > PALLET_LINE.outfeedDwellS) {
            // paletul părăsește linia
            for (const cid of p.children!) {
              const c = this.products.get(cid);
              if (c) {
                if (c.kind === 'bucket' && c.tDepal !== undefined)
                  this.archive.push({ id: c.id, serial: c.serial, tDepal: c.tDepal, tLabel: c.tLabel, tInspect: c.tInspect, tRepal: c.tRepal, reject: c.reject });
                c.state = 'done';
                this.products.delete(cid);
              }
            }
            PL.zones[zi].occupant = null;
            this.products.delete(p.id);
            this.palletsOut++;
            this.message(`Palet ${p.serial} livrat (înfoliat) – ${this.palletsOut} paleți`);
            this.endOp(this.beginOp('PALLET_LINE', `Palet ${p.serial} ieșire`, '#4f8de6', p.id));
            this.notify();
          }
          continue;
      }
      if (release && PL.mode !== 'accumulate' && speed > 0 && zi + 1 < zones.length && PL.zones[zi + 1].occupant === null) {
        p.moving = true;
        PL.zones[zi + 1].occupant = p.id; // rezervă zona următoare
        this.beginOp('PALLET_LINE', `Palet ${p.serial}: ${zone.id.replace('CDLR_', '')} → ${zones[zi + 1].id.replace('CDLR_', '')}`, '#4f8de6', p.id).end =
          this.t + PALLET_LINE.zoneLength / Math.max(1, speed);
      }
    }
  }

  private updatePalletChildren(p: Product) {
    const rad = ((p.spin ?? 0) * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    for (const cid of p.children!) {
      const ch = this.products.get(cid);
      if (!ch || ch.state !== 'onPallet') continue;
      ch.x = p.x + ch.ox! * c + ch.oz! * s;
      ch.z = p.z - ch.ox! * s + ch.oz! * c;
      ch.y = p.y + ch.oy!;
      ch.yaw = p.spin ?? 0;
    }
    p.yaw = p.spin ?? 0;
  }

  // ---------- conveioare găleți ----------------------------------------------
  private stopActiveFor(conv: BucketConveyorState, stop: BucketConveyorState['stops'][number], b: Product): boolean {
    if (conv.mode === 'accumulate') return stop.kind === 'end' || stop.s >= conv.length - 1;
    if (stop.kind === 'reject') return !!b.reject && b.inspected;
    if (stop.kind === 'end') return true;
    return stop.active;
  }

  private stepBucketConveyors(dt: number) {
    const pitch = BUCKET.dia + BUCKET.gapOnConveyor;
    for (const conv of Object.values(this.conveyors)) {
      const path = this.paths[conv.id];
      const items = [...this.products.values()].filter((p) => p.state === 'onConveyor' && p.conveyor === conv.id && p.kind === 'bucket').sort((a, b) => b.s! - a.s!);
      conv.count = items.length;
      const speed = conv.mode === 'stop' ? 0 : conv.speed;
      let aheadS: number | null = null; // produsul din față (pe același conveior)
      for (const b of items) {
        let sNew = b.s! + speed * dt;
        b.blocked = false;
        // opritoare
        for (const st of conv.stops) {
          if (b.s! <= st.s + 0.01 && sNew > st.s && this.stopActiveFor(conv, st, b)) {
            sNew = st.s;
            b.blocked = true;
          }
        }
        // acumulare în spatele produsului din față
        if (aheadS !== null && sNew > aheadS - pitch) {
          sNew = Math.max(b.s!, aheadS - pitch);
          b.blocked = true;
        }
        // capăt de conveior → transfer
        if (sNew >= conv.length) {
          const nextId = BUCKET_LINE.conveyors.find((c) => c.id === conv.id)?.next;
          if (nextId) {
            // verifică spațiu la începutul conveiorului următor
            const nextItems = [...this.products.values()].filter((p) => p.state === 'onConveyor' && p.conveyor === nextId && p.kind === 'bucket');
            const minS = nextItems.reduce((m, p) => Math.min(m, p.s!), Infinity);
            const over = sNew - conv.length;
            if (minS - over >= pitch) {
              b.conveyor = nextId;
              b.s = over;
              const pos = this.paths[nextId].at(b.s);
              b.x = pos.x;
              b.z = pos.z;
              b.yaw = pos.yaw;
              continue;
            }
            sNew = conv.length - 0.01;
            b.blocked = true;
          } else {
            sNew = Math.min(sNew, conv.length - BUCKET.dia / 2);
            b.blocked = true;
          }
        }
        b.s = sNew;
        aheadS = sNew;
        const pos = path.at(sNew);
        b.x = pos.x;
        b.z = pos.z;
        b.y = BUCKET_LINE.tor;
        b.yaw = pos.yaw;
      }
      // fotocelule
      for (const pc of conv.photocells) pc.blocked = items.some((b) => Math.abs(b.s! - pc.s) <= BUCKET.dia / 2);
      // operații Gantt pe conveioare: B3 – așteptare la opritorul de capăt; B1 – lot până la tunel
      if (conv.id === 'CONV_B3') {
        const st = conv.stops.find((x) => x.kind === 'end')!;
        for (const b of items) {
          if (b.blocked && Math.abs(b.s! - st.s) < 0.5 && !this.ops.some((o) => o.resource === 'CONV_B3' && o.ref === b.id)) this.beginOp('CONV_B3', `G${b.serial} la opritor repal`, '#8fb46a', b.id);
        }
      }
      if (conv.id === 'CONV_B1') {
        const pcTun = conv.photocells.find((p) => p.id === 'PE_B1_TUN');
        for (const op of this.ops) {
          if (op.resource !== 'CONV_B1' || op.end !== undefined || !op.ref) continue;
          const ids = op.ref.split(',');
          const passed = ids.every((id) => {
            const b = this.products.get(id);
            return !b || b.conveyor !== 'CONV_B1' || (pcTun ? b.s! > pcTun.s : true);
          });
          if (passed) op.end = this.t;
        }
      }
    }
  }

  // ---------- stații ---------------------------------------------------------
  private bucketAtStop(convId: string, stopId: string): Product | null {
    const conv = this.conveyors[convId];
    const st = conv.stops.find((s) => s.id === stopId)!;
    for (const p of this.products.values()) {
      if (p.state === 'onConveyor' && p.conveyor === convId && p.kind === 'bucket' && Math.abs(p.s! - st.s) < 0.5 && p.blocked) return p;
    }
    return null;
  }

  private stepStations(dt: number) {
    const conv = this.conveyors.CONV_B1;
    const seq = this.sequence.stations;
    // --- etichetator
    {
      const L = this.labeler;
      const st = conv.stops.find((s) => s.id === 'ST_LAB')!;
      if (L.releaseUntilPassed) {
        const b = this.products.get(L.releaseUntilPassed);
        if (!b || b.conveyor !== 'CONV_B1' || b.s! > st.s + BUCKET.dia) {
          L.releaseUntilPassed = null;
          st.active = true;
        }
      } else if (!L.busy) {
        const b = this.bucketAtStop('CONV_B1', 'ST_LAB');
        if (b && !b.labeled) {
          L.busy = true;
          L.bucket = b.id;
          L.tEnd = this.t + seq.labeler.duration;
          L.op = this.beginOp('EQ_LABELER', `${seq.labeler.name} G${b.serial}`, '#c678dd', b.id);
        } else if (b && b.labeled) {
          st.active = false;
          L.releaseUntilPassed = b.id;
        }
      } else if (this.t >= L.tEnd) {
        const b = this.products.get(L.bucket!);
        if (b) {
          b.labeled = true;
          b.tLabel = this.t;
        }
        L.busy = false;
        L.count++;
        this.endOp(L.op);
        st.active = false;
        L.releaseUntilPassed = L.bucket;
        L.bucket = null;
      }
    }
    // --- inspecție vision
    {
      const V = this.vision;
      const st = conv.stops.find((s) => s.id === 'ST_VIS')!;
      V.flash = Math.max(0, V.flash - dt);
      if (V.releaseUntilPassed) {
        const b = this.products.get(V.releaseUntilPassed);
        if (!b || b.conveyor !== 'CONV_B1' || b.s! > st.s + BUCKET.dia) {
          V.releaseUntilPassed = null;
          st.active = true;
        }
      } else if (!V.busy) {
        const b = this.bucketAtStop('CONV_B1', 'ST_VIS');
        if (b && !b.inspected) {
          V.busy = true;
          V.bucket = b.id;
          V.tEnd = this.t + seq.vision.duration;
          V.flash = 0.3;
          V.op = this.beginOp('EQ_VISION', `${seq.vision.name} G${b.serial}`, '#e06c75', b.id);
        } else if (b && b.inspected) {
          st.active = false;
          V.releaseUntilPassed = b.id;
        }
      } else if (this.t >= V.tEnd) {
        const b = this.products.get(V.bucket!);
        V.inspected++;
        if (b) {
          b.inspected = true;
          b.tInspect = this.t;
          b.reject = seq.vision.rejectEvery > 0 && V.inspected % seq.vision.rejectEvery === 0;
          if (b.reject) {
            V.rejected++;
            V.op!.color = '#ff4d4d';
            V.op!.name += ' – REBUT';
            this.message(`Inspecție vision: găleata ${b.serial} RESPINSĂ (${V.rejected} rebuturi)`);
          }
        }
        V.busy = false;
        this.endOp(V.op);
        st.active = false;
        V.releaseUntilPassed = V.bucket;
        V.bucket = null;
      }
    }
    // --- pusher rebut
    {
      const P = this.pusher;
      const PU = STATIONS.pusher;
      if (P.phase === 'idle') {
        const b = this.bucketAtStop('CONV_B1', 'ST_REJ');
        if (b && b.reject) {
          P.phase = 'extend';
          P.t0 = this.t;
          P.bucket = b.id;
          const ch = STATIONS.chute;
          b.state = 'anim';
          b.conveyor = undefined;
          const y0 = BUCKET_LINE.tor;
          b.anim = {
            t0: this.t,
            then: 'stored',
            frames: [
              { x: b.x, y: y0, z: b.z, t: 0 },
              { x: ch.start.x, y: ch.topY, z: ch.start.z, t: PU.extendS },
              { x: ch.end.x, y: ch.bottomY, z: ch.end.z, t: PU.extendS + ch.slideS },
              { x: ch.end.x - 160 + (this.rejectBin % 2) * 320, y: Math.floor(this.rejectBin / 2) * BUCKET.h * 0.25, z: ch.end.z - 520, t: PU.extendS + ch.slideS + 0.4 },
            ],
          };
          this.rejectBin++;
          this.endOp(this.beginOp('EQ_VISION', `Pusher → tobogan G${b.serial}`, '#b22222', b.id));
        }
      } else if (P.phase === 'extend') {
        P.ext = Math.min(1, (this.t - P.t0) / PU.extendS);
        if (P.ext >= 1) {
          P.phase = 'retract';
          P.t0 = this.t;
        }
      } else {
        P.ext = Math.max(0, 1 - (this.t - P.t0) / PU.retractS);
        if (P.ext <= 0) {
          P.phase = 'idle';
          P.bucket = null;
        }
      }
    }
  }

  // ---------- animații produse -----------------------------------------------
  private stepAnimations() {
    for (const p of this.products.values()) {
      if (p.state !== 'anim' || !p.anim) continue;
      const a = p.anim;
      const tt = this.t - a.t0;
      const fr = a.frames;
      if (tt >= fr[fr.length - 1].t) {
        const last = fr[fr.length - 1];
        p.x = last.x;
        p.y = last.y;
        p.z = last.z;
        p.state = a.then;
        p.anim = undefined;
        continue;
      }
      let i = 1;
      while (i < fr.length - 1 && fr[i].t < tt) i++;
      const a0 = fr[i - 1];
      const a1 = fr[i];
      const u = (tt - a0.t) / Math.max(1e-6, a1.t - a0.t);
      p.x = a0.x + (a1.x - a0.x) * u;
      p.y = a0.y + (a1.y - a0.y) * u;
      p.z = a0.z + (a1.z - a0.z) * u;
    }
  }

  // ---------- roboți ---------------------------------------------------------
  private updateRobotFK(r: RobotRuntime) {
    forwardKinematics(r.cfg, r.q, r.fk);
    r.tcp.setFromMatrixPosition(r.fk.tcp);
    // produse transportate
    const v = new Vector3();
    for (const id of r.carried) {
      const p = this.products.get(id);
      if (!p || !p.carryOffset) continue;
      v.set(p.carryOffset[0], p.carryOffset[1], p.carryOffset[2]).applyMatrix4(r.fk.tcp);
      p.x = v.x;
      p.y = v.y;
      p.z = v.z;
      p.yaw = this.toolYaw(r) + (p.carryYaw ?? 0);
    }
    // coliziuni
    toolAABB(r.cfg, r.fk.flange, r.toolBox);
    r.collision = null;
    r.collisionBodyId = null;
    if (this.collisionEnabled) {
      for (const b of this.staticBodies) {
        if (b.id === r.cfg.id + '_MOUNT') continue;
        if (aabbOverlap(r.toolBox, b)) {
          r.collision = b.name;
          r.collisionBodyId = b.id;
          break;
        }
      }
    }
  }

  private toolYaw(r: RobotRuntime): number {
    const e = r.fk.tcp.elements;
    // axa X a sculei (coloana 0) proiectată pe orizontală
    return (Math.atan2(-e[2], e[0]) * 180) / Math.PI;
  }

  private stepTargetPose(r: RobotRuntime, step: SequenceStep): Matrix4 | null {
    const task = r.task!;
    const up = new Matrix4().makeTranslation(0, MOTION.approachHeight, 0);
    switch (step.target) {
      case 'pick':
        return task.pick;
      case 'prePick':
        return new Matrix4().multiplyMatrices(up, task.pick);
      case 'place':
        return task.place;
      case 'prePlace':
        return new Matrix4().multiplyMatrices(up, task.place);
      case 'home':
        return forwardKinematics(r.cfg, r.cfg.home).tcp;
      default:
        return null;
    }
  }

  /** pornește mișcarea către o poziție-țintă; durata = max(durata din secvență, durata la vitezele de catalog) */
  private startMotion(r: RobotRuntime, target: Matrix4, duration: number) {
    const res = solveIKRobust(r.cfg, target, r.q);
    const q1 = res.q.slice();
    // axe „infinite”: alege echivalentul ±360° cel mai apropiat de poziția curentă
    for (let i = 0; i < q1.length; i++) {
      const j = r.cfg.joints[i];
      if (j.max - j.min < 350) continue;
      while (q1[i] - r.q[i] > 180 && q1[i] - 360 >= j.min) q1[i] -= 360;
      while (q1[i] - r.q[i] < -180 && q1[i] + 360 <= j.max) q1[i] += 360;
    }
    let dur = duration;
    for (let i = 0; i < q1.length; i++) dur = Math.max(dur, Math.abs(q1[i] - r.q[i]) / r.cfg.joints[i].speed);
    r.motion = { q0: r.q.slice(), q1, t0: this.t, dur: Math.max(0.05, dur) };
    r.ikInfo = res.converged ? `IK ok (${res.iterations} it, ε=${res.posErr.toFixed(2)} mm)` : `IK neconvergent (ε=${res.posErr.toFixed(0)} mm)`;
    if (!res.converged) this.message(`${r.cfg.name}: punct inaccesibil (ε=${res.posErr.toFixed(0)} mm)`);
  }

  private stepRobot(r: RobotRuntime, _dt: number) {
    if (r.manual) {
      // în mod manual robotul nu este condus de secvență (până la Play)
      this.updateRobotFK(r);
      return;
    }
    if (!r.task) {
      const task = r.cfg.id === 'ROBOT_1' ? this.planRobot1() : this.planRobot2();
      if (!task) {
        r.state = 'IDLE';
        this.updateRobotFK(r);
        return;
      }
      if (r.waitOp) {
        this.endOp(r.waitOp);
        r.waitOp = null;
      }
      r.task = task;
      r.stepIdx = -1;
      this.nextStep(r);
    }
    // execută pasul curent
    const step = r.task!.steps[r.stepIdx];
    const elapsed = this.t - r.stepT0;
    if (r.motion) {
      const u = smooth(elapsed / r.motion.dur);
      for (let i = 0; i < r.q.length; i++) r.q[i] = r.motion.q0[i] + (r.motion.q1[i] - r.motion.q0[i]) * u;
      if (elapsed >= r.motion.dur) {
        r.q = r.motion.q1.slice();
        r.motion = null;
        this.updateRobotFK(r);
        this.nextStep(r);
        return;
      }
    } else if (elapsed >= step.duration) {
      this.nextStep(r);
      return;
    }
    this.updateRobotFK(r);
  }

  private nextStep(r: RobotRuntime) {
    this.endOp(r.currentOp);
    r.currentOp = null;
    r.stepIdx++;
    const task = r.task!;
    if (r.stepIdx >= task.steps.length) {
      r.task = null;
      r.state = 'IDLE';
      return;
    }
    const step = task.steps[r.stepIdx];
    r.stepT0 = this.t;
    r.state = step.name;
    r.currentOp = this.beginOp(r.cfg.id, step.name, step.color, task.productIds[0]);
    if (step.action === 'grip') this.grip(r);
    if (step.action === 'release') this.release(r);
    const target = this.stepTargetPose(r, step);
    if (target) this.startMotion(r, target, step.duration);
  }

  private grip(r: RobotRuntime) {
    const task = r.task!;
    const inv = new Matrix4().copy(r.fk.tcp).invert();
    const v = new Vector3();
    const tcpYaw = this.toolYaw(r);
    for (const id of task.productIds) {
      const p = this.products.get(id);
      if (!p) continue;
      // scoate produsul de pe palet / conveior
      if (p.state === 'onPallet' && p.palletId) {
        const pal = this.products.get(p.palletId);
        if (pal?.children) pal.children = pal.children.filter((c) => c !== id);
      }
      if (p.kind === 'sheet' && p.state === 'stored') {
        // foaie din magazie
        this.sheetMagazine = Math.max(0, this.sheetMagazine - 1);
      }
      p.state = 'carried';
      p.conveyor = undefined;
      p.palletId = undefined;
      v.set(p.x, p.y, p.z).applyMatrix4(inv);
      p.carryOffset = [v.x, v.y, v.z];
      p.carryYaw = p.yaw - tcpYaw;
      r.carried.push(id);
    }
  }

  private release(r: RobotRuntime) {
    const task = r.task!;
    const ids = r.carried.slice();
    r.carried = [];
    for (const id of ids) {
      const p = this.products.get(id);
      if (!p) continue;
      p.carryOffset = undefined;
      switch (task.kind) {
        case 'row': {
          // depunere pe B1
          if (!this.ops.some((o) => o.resource === 'CONV_B1' && o.ref === ids.join(','))) this.beginOp('CONV_B1', `Lot ${ids.map((i) => this.serialOf(i)).join('/')} → tunel`, '#5fb0a8', ids.join(','));
          const path = this.paths.CONV_B1;
          p.state = 'onConveyor';
          p.conveyor = 'CONV_B1';
          p.s = path.project(p.x, p.z);
          p.blocked = false;
          const pos = path.at(p.s);
          p.x = pos.x;
          p.z = pos.z;
          p.y = BUCKET_LINE.tor;
          p.yaw = 0;
          p.tDepal = this.t;
          break;
        }
        case 'sheetRemove': {
          // foaia cade în container
          const B = STATIONS.sheetWasteBin;
          const n = this.sheetBin++;
          p.state = 'anim';
          p.anim = {
            t0: this.t,
            then: 'stored',
            frames: [
              { x: p.x, y: p.y, z: p.z, t: 0 },
              { x: B.center.x, y: 40 + n * SLIP_SHEET.t * 3, z: B.center.z, t: 0.9 },
            ],
          };
          p.yaw = 90;
          break;
        }
        case 'bucket':
        case 'sheetPlace': {
          const pal = this.products.get(task.palletId!);
          if (!pal) break;
          p.state = 'onPallet';
          p.palletId = pal.id;
          p.layer = task.layer;
          // fixează exact în poziția-țintă (evită deriva IK)
          const tp = new Vector3().setFromMatrixPosition(task.place);
          const h = p.kind === 'bucket' ? BUCKET.h : SLIP_SHEET.t;
          p.x = tp.x;
          p.z = tp.z;
          p.y = tp.y - h;
          p.yaw = 0;
          p.ox = p.x - pal.x;
          p.oz = p.z - pal.z;
          p.oy = p.y - pal.y;
          pal.children!.push(p.id);
          if (p.kind === 'bucket') {
            p.slot = task.slots?.[0];
            p.tRepal = this.t;
            this.produced++;
            this.placeTimes.push(this.t);
            const perLayer = PATTERN.layers.reduce((m, l) => Math.max(m, l.flat().length), 0);
            const total = PATTERN.layers.reduce((s, l) => s + l.flat().length, 0);
            const nb = pal.children!.filter((c) => this.products.get(c)?.kind === 'bucket').length;
            if (nb >= total) {
              pal.complete = true;
              this.message(`Palet ${pal.serial} repaletizat complet (${total} găleți) → infoliator`);
            } else if (nb % perLayer === 0) {
              this.message(`Palet ${pal.serial}: nivel ${nb / perLayer} complet`);
            }
          }
          break;
        }
      }
    }
    this.notify();
  }

  /** B1: zona de depunere liberă? */
  private dropZoneClear(): boolean {
    const limit = BUCKET_LINE.dropSlots[BUCKET_LINE.dropSlots.length - 1] + BUCKET.dia;
    for (const p of this.products.values()) if (p.state === 'onConveyor' && p.conveyor === 'CONV_B1' && p.s! < limit) return false;
    return true;
  }

  // --- planificare Robot 1 (depaletizare rând cu rând) -----------------------
  private planRobot1(): RobotTask | null {
    const r = this.robots.ROBOT_1;
    const zi = PALLET_LINE.zones.findIndex((z) => z.role === 'depal');
    const palId = this.palletLine.zones[zi].occupant;
    const pal = palId ? this.products.get(palId) : null;
    if (!pal || pal.moving || !pal.children || pal.children.length === 0) return null;
    const kids = pal.children.map((id) => this.products.get(id)!).filter(Boolean);
    const topLayer = Math.max(...kids.map((k) => k.layer ?? 0));
    const topBuckets = kids.filter((k) => k.kind === 'bucket' && k.layer === topLayer);
    const topSheet = kids.find((k) => k.kind === 'sheet' && k.layer === topLayer);
    const seq = this.sequence.robot1;
    if (topBuckets.length > 0) {
      if (!this.dropZoneClear()) {
        if (!r.waitOp) r.waitOp = this.beginOp('ROBOT_1', seq.waitName, '#555c66');
        r.state = 'WAIT B1';
        return null;
      }
      // rândul cel mai apropiat de robot (x max) rămas pe nivel
      const rows = PATTERN.layers[topLayer];
      let bestRow: Product[] | null = null;
      let bestX = -Infinity;
      rows.forEach((row, ri) => {
        const rowBuckets = row
          .map((_, k) => topBuckets.find((b) => b.slot === ri * row.length + k))
          .filter((b): b is Product => !!b);
        if (rowBuckets.length === 0) return;
        const x = rowBuckets[0].x;
        if (x > bestX) {
          bestX = x;
          bestRow = rowBuckets;
        }
      });
      const rowBuckets = bestRow! as Product[];
      const cx = rowBuckets.reduce((s, b) => s + b.x, 0) / rowBuckets.length;
      const cz = rowBuckets.reduce((s, b) => s + b.z, 0) / rowBuckets.length;
      const top = rowBuckets[0].y + BUCKET.h;
      const pick = toolPoseDown({ x: cx, y: top, z: cz }, [0, 0, 1]);
      // depunere pe B1: centrul lotului
      const path = this.paths.CONV_B1;
      const slots = BUCKET_LINE.dropSlots;
      const sc = slots.reduce((a, b) => a + b, 0) / slots.length;
      const pp = path.at(sc);
      const place = toolPoseDown({ x: pp.x, y: BUCKET_LINE.tor + BUCKET.h, z: pp.z }, [1, 0, 0]);
      return { kind: 'row', productIds: rowBuckets.map((b) => b.id), pick, place, palletId: pal.id, layer: topLayer, steps: seq.rowCycle };
    }
    if (topSheet) {
      const pick = toolPoseDown({ x: topSheet.x, y: topSheet.y + SLIP_SHEET.t, z: topSheet.z }, [0, 0, 1]);
      const B = STATIONS.sheetWasteBin;
      const place = toolPoseDown({ x: B.center.x, y: B.size.h + 600, z: B.center.z }, [0, 0, 1]);
      return { kind: 'sheetRemove', productIds: [topSheet.id], pick, place, palletId: pal.id, layer: topLayer, steps: seq.sheetCycle };
    }
    return null;
  }

  // --- planificare Robot 2 (repaletizare) ------------------------------------
  private planRobot2(): RobotTask | null {
    const r = this.robots.ROBOT_2;
    const zi = PALLET_LINE.zones.findIndex((z) => z.role === 'repal');
    const palId = this.palletLine.zones[zi].occupant;
    const pal = palId ? this.products.get(palId) : null;
    if (!pal || pal.moving || pal.complete) return null;
    const kids = pal.children!.map((id) => this.products.get(id)!).filter(Boolean);
    const layers = PATTERN.layers;
    const seq = this.sequence.robot2;
    // nivelul curent = primul nivel incomplet
    let L = 0;
    for (; L < layers.length; L++) {
      const n = kids.filter((k) => k.kind === 'bucket' && k.layer === L).length;
      if (n < layers[L].flat().length) break;
    }
    if (L >= layers.length) {
      pal.complete = true;
      return null;
    }
    // foaia de sub nivelul L (L>0) trebuie pusă înainte
    if (L > 0 && !kids.some((k) => k.kind === 'sheet' && k.layer === L - 1)) {
      const M = STATIONS.sheetMagazine;
      const topY = M.platformH + this.sheetMagazine * SLIP_SHEET.t;
      const sid = this.newId('SHT');
      const sheet: Product = {
        id: sid,
        kind: 'sheet',
        serial: this.serialOf(sid),
        x: M.center.x,
        y: topY - SLIP_SHEET.t,
        z: M.center.z,
        yaw: 0,
        state: 'stored',
        labeled: false,
        inspected: false,
        reject: false,
      };
      this.products.set(sheet.id, sheet);
      this.notify();
      const pick = toolPoseDown({ x: M.center.x, y: topY, z: M.center.z }, [1, 0, 0]);
      const place = toolPoseDown({ x: pal.x, y: pal.y + (sheetBottomY(L - 1) - PALLET_LINE.tor) + SLIP_SHEET.t, z: pal.z }, [1, 0, 0]);
      return { kind: 'sheetPlace', productIds: [sheet.id], pick, place, palletId: pal.id, layer: L - 1, steps: seq.sheetCycle };
    }
    // găleată disponibilă la capătul conveiorului de retur?
    const b = this.bucketAtStop('CONV_B3', 'ST_REPAL');
    if (!b) {
      if (!r.waitOp) r.waitOp = this.beginOp('ROBOT_2', seq.waitName, '#555c66');
      r.state = 'WAIT găleată';
      return null;
    }
    // slotul liber următor pe nivelul L
    const slots = layers[L].flat();
    const used = new Set(kids.filter((k) => k.kind === 'bucket' && k.layer === L).map((k) => k.slot));
    let slot = 0;
    while (used.has(slot) && slot < slots.length) slot++;
    const sp = slots[slot];
    const pick = toolPoseDown({ x: b.x, y: b.y + BUCKET.h, z: b.z }, [1, 0, 0]);
    const place = toolPoseDown({ x: pal.x + sp.x, y: pal.y + (bucketBottomY(L) - PALLET_LINE.tor) + BUCKET.h, z: pal.z + sp.z }, [1, 0, 0]);
    // marchează ca preluată (scoate de pe conveior pentru a elibera opritorul imediat ce robotul prinde)
    this.endOp(this.ops.find((o) => o.resource === 'CONV_B3' && o.ref === b.id && o.end === undefined) ?? null);
    return { kind: 'bucket', productIds: [b.id], pick, place, palletId: pal.id, layer: L, slots: [slot], steps: seq.bucketCycle };
  }

  // ---------------------------------------------------------------- metrici / snapshot
  rateBpm(): number {
    const w = SIM.rateWindowS;
    const from = this.t - w;
    const n = this.placeTimes.filter((x) => x > from).length;
    if (this.t < w) return this.t > 1 ? (n / this.t) * 60 : 0;
    return (n / w) * 60;
  }
  avgBpm(): number {
    return this.t > 1 ? (this.produced / this.t) * 60 : 0;
  }

  snapshot(): Snapshot {
    return {
      t: this.t,
      tick: this.tick,
      produced: this.produced,
      rejected: this.vision.rejected,
      palletsOut: this.palletsOut,
      rateBpm: this.rateBpm(),
      avgBpm: this.avgBpm(),
      targetBpm: this.sequence.targetRateBpm ?? SIM.targetRateBpm,
      robots: Object.values(this.robots).map((r) => ({
        id: r.cfg.id,
        q: r.q.slice(),
        tcp: toWPR(r.fk.tcp),
        state: r.state,
        currentOp: r.currentOp?.name ?? null,
        collision: r.collision,
        carrying: r.carried.length,
        manual: r.manual,
        ikInfo: r.ikInfo,
      })),
      conveyors: Object.values(this.conveyors).map((c) => ({ ...c, stops: c.stops.map((s) => ({ ...s })), photocells: c.photocells.map((p) => ({ ...p })) })),
      palletLine: { ...this.palletLine, zones: this.palletLine.zones.map((z) => ({ ...z })) },
      stations: {
        labeler: { busy: this.labeler.busy, count: this.labeler.count, bucket: this.labeler.bucket },
        vision: { busy: this.vision.busy, inspected: this.vision.inspected, rejected: this.vision.rejected, bucket: this.vision.bucket },
        wrapper: { busy: this.wrapper.busy, progress: this.wrapper.progress, count: this.wrapper.count },
        sheetMagazine: this.sheetMagazine,
        sheetBin: this.sheetBin,
        rejectBin: this.rejectBin,
      },
      productsVersion: this.productsVersion,
      bodies: this.bodiesCount,
      messages: this.messages.slice(-5),
    };
  }

  /** date pentru export CSV: timpii de ciclu pe găleată */
  cycleRecords() {
    const rows = this.archive.slice();
    for (const p of this.products.values()) {
      if (p.kind !== 'bucket' || p.tDepal === undefined) continue;
      rows.push({ id: p.id, serial: p.serial, tDepal: p.tDepal, tLabel: p.tLabel, tInspect: p.tInspect, tRepal: p.tRepal, reject: p.reject });
    }
    return rows.sort((a, b) => (a.tDepal ?? 0) - (b.tDepal ?? 0));
  }

  /** resetează modul manual al roboților (la Play) */
  resumeAuto() {
    for (const r of Object.values(this.robots)) {
      if (r.manual) {
        r.manual = false;
        r.task = null;
        r.motion = null;
        for (const id of r.carried) {
          const p = this.products.get(id);
          if (p) this.products.delete(p.id);
        }
        r.carried = [];
      }
    }
    this.notify();
  }
}

export const engine = new Engine();
