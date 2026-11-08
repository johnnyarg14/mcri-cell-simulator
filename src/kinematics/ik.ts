import { Matrix4, Vector3, Quaternion } from 'three';
import type { RobotConfig } from '../config/cell.config';
import { forwardKinematics } from './fk';

const DEG = Math.PI / 180;

export type IKResult = {
  q: number[];
  converged: boolean;
  posErr: number; // mm
  rotErr: number; // grade
  iterations: number;
};

export type IKOptions = {
  maxIter?: number;
  posTol?: number; // mm
  rotTol?: number; // grade
  lambda?: number; // amortizare DLS
  rotWeight?: number; // mm per radian – ponderea erorii de orientare
  maxStepDeg?: number;
  positionOnly?: boolean;
};

function clampToLimits(cfg: RobotConfig, q: number[]) {
  for (let i = 0; i < q.length; i++) {
    const j = cfg.joints[i];
    if (q[i] < j.min) q[i] = j.min;
    if (q[i] > j.max) q[i] = j.max;
  }
}

/** eroarea de poziție (3) + orientare (3, axă·unghi) între două matrice */
export function poseError(target: Matrix4, current: Matrix4, out: number[], rotWeight: number, positionOnly: boolean) {
  const pt = new Vector3().setFromMatrixPosition(target);
  const pc = new Vector3().setFromMatrixPosition(current);
  out[0] = pt.x - pc.x;
  out[1] = pt.y - pc.y;
  out[2] = pt.z - pc.z;
  if (positionOnly) {
    out[3] = out[4] = out[5] = 0;
    return;
  }
  const qt = new Quaternion().setFromRotationMatrix(target);
  const qc = new Quaternion().setFromRotationMatrix(current);
  const qe = qt.multiply(qc.invert()); // R_err = R_t · R_c^T
  if (qe.w < 0) qe.set(-qe.x, -qe.y, -qe.z, -qe.w);
  const s = Math.sqrt(1 - Math.min(1, qe.w * qe.w));
  const ang = 2 * Math.acos(Math.min(1, qe.w));
  const k = s > 1e-9 ? ang / s : 2; // axă·unghi
  out[3] = qe.x * k * rotWeight;
  out[4] = qe.y * k * rotWeight;
  out[5] = qe.z * k * rotWeight;
}

/** rezolvă (A·x = b) pentru matrice 6×6 prin eliminare Gauss cu pivotare */
function solve6(A: number[][], b: number[]): number[] {
  const n = 6;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/**
 * Cinematică inversă numerică – Jacobian numeric + Damped Least Squares,
 * cu limite de axe. Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e
 */
export function solveIK(cfg: RobotConfig, target: Matrix4, seedDeg: number[], opts: IKOptions = {}): IKResult {
  const maxIter = opts.maxIter ?? 150;
  const posTol = opts.posTol ?? 0.5;
  const rotTol = opts.rotTol ?? 0.25;
  const rotWeight = opts.rotWeight ?? 400;
  const maxStep = opts.maxStepDeg ?? 20;
  const positionOnly = opts.positionOnly ?? false;
  const n = cfg.axes;
  const q = seedDeg.slice(0, n);
  clampToLimits(cfg, q);
  const e = new Array<number>(6).fill(0);
  const e2 = new Array<number>(6).fill(0);
  const J: number[][] = Array.from({ length: 6 }, () => new Array<number>(n).fill(0));
  const h = 0.25; // grade – pas pentru diferențe finite
  let it = 0;
  let posErr = Infinity;
  let rotErr = Infinity;
  const fk = forwardKinematics(cfg, q);
  for (it = 0; it < maxIter; it++) {
    forwardKinematics(cfg, q, fk);
    poseError(target, fk.tcp, e, rotWeight, positionOnly);
    posErr = Math.hypot(e[0], e[1], e[2]);
    rotErr = Math.hypot(e[3], e[4], e[5]) / rotWeight / DEG;
    if (posErr < posTol && (positionOnly || rotErr < rotTol)) return { q, converged: true, posErr, rotErr, iterations: it };
    // Jacobian numeric
    for (let j = 0; j < n; j++) {
      const q0 = q[j];
      q[j] = q0 + h;
      forwardKinematics(cfg, q, fk);
      poseError(target, fk.tcp, e2, rotWeight, positionOnly);
      for (let r = 0; r < 6; r++) J[r][j] = (e[r] - e2[r]) / (h * DEG); // d(e)/dq (rad)
      q[j] = q0;
    }
    // amortizare adaptivă: mai mare departe de țintă
    const lambda = opts.lambda ?? Math.max(20, Math.min(300, posErr * 0.3));
    const A: number[][] = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += J[r][j] * J[c][j];
        A[r][c] = s + (r === c ? lambda * lambda : 0);
      }
    }
    const y = solve6(A, e);
    for (let j = 0; j < n; j++) {
      let dq = 0;
      for (let r = 0; r < 6; r++) dq += J[r][j] * y[r];
      dq /= DEG; // în grade
      if (dq > maxStep) dq = maxStep;
      if (dq < -maxStep) dq = -maxStep;
      q[j] += dq;
    }
    clampToLimits(cfg, q);
  }
  return { q, converged: false, posErr, rotErr, iterations: it };
}

/** seed analitic: J1 orientat spre țintă, restul din cfg.ikSeed */
export function analyticSeed(cfg: RobotConfig, target: Matrix4): number[] {
  const p = new Vector3().setFromMatrixPosition(target);
  const dx = p.x - cfg.base.x;
  const dz = p.z - cfg.base.z;
  const q = cfg.ikSeed.slice();
  q[0] = Math.atan2(-dz, dx) / DEG; // rotație în jurul +Y: +X → (cos θ, 0, −sin θ)
  const j = cfg.joints[0];
  if (q[0] < j.min) q[0] += 360;
  if (q[0] > j.max) q[0] -= 360;
  return q;
}

/**
 * Încearcă mai multe seed-uri (continuitate, analitic, config) și alege soluția
 * convergentă cu postura cea mai „naturală” (apropiată de seed-ul analitic: cot sus,
 * încheietură fără răsturnare). Evită configurațiile în care brațul trece peste bază.
 */
export function solveIKRobust(cfg: RobotConfig, target: Matrix4, currentQ: number[], opts: IKOptions = {}): IKResult {
  const nominal = analyticSeed(cfg, target);
  const seeds = [currentQ, nominal, cfg.ikSeed];
  let best: IKResult | null = null;
  let bestCost = Infinity;
  let fallback: IKResult | null = null;
  for (const s of seeds) {
    const r = solveIK(cfg, target, s, opts);
    if (!r.converged) {
      if (!fallback || r.posErr < fallback.posErr) fallback = r;
      continue;
    }
    let cost = 0;
    for (let i = 0; i < r.q.length; i++) {
      let d = r.q[i] - nominal[i];
      if (i === 0 || i >= 3) d = ((d + 180) % 360 + 360) % 360 - 180; // axe de rotație „infinită”
      const w = i === 1 || i === 2 ? 3 : 1; // J2/J3 definesc postura
      cost += w * d * d;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = r;
    }
  }
  return best ?? fallback!;
}
