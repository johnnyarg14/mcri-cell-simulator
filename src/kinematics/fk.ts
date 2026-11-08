import { Matrix4, Vector3, Quaternion } from 'three';
import type { ChainLink, RobotConfig, Vec3 } from '../config/cell.config';

const DEG = Math.PI / 180;

/** unghiul fiecărui element de lanț (grade) pentru vectorul de axe active q */
export function chainAngles(chain: ChainLink[], qDeg: number[]): number[] {
  return chain.map((l) => {
    let a = l.offsetDeg ?? 0;
    for (let i = 0; i < l.coeffs.length; i++) a += l.coeffs[i] * (qDeg[i] ?? 0);
    return a;
  });
}

export function baseMatrix(base: Vec3): Matrix4 {
  return new Matrix4().makeTranslation(base.x, base.y, base.z);
}

export type FKResult = {
  /** cadrul după fiecare element (în coordonate celulă) */
  frames: Matrix4[];
  flange: Matrix4;
  tcp: Matrix4;
};

const _t = new Matrix4();
const _r = new Matrix4();
const _axis = new Vector3();

/** cinematică directă generală: T = T_base · Π (Trans(t_i) · Rot(axis_i, θ_i)) */
export function forwardKinematics(cfg: RobotConfig, qDeg: number[], out?: FKResult): FKResult {
  const angles = chainAngles(cfg.chain, qDeg);
  const frames = out?.frames ?? cfg.chain.map(() => new Matrix4());
  let cur = baseMatrix(cfg.base);
  for (let i = 0; i < cfg.chain.length; i++) {
    const l = cfg.chain[i];
    _t.makeTranslation(l.translate[0], l.translate[1], l.translate[2]);
    _axis.set(l.axis[0], l.axis[1], l.axis[2]).normalize();
    _r.makeRotationAxis(_axis, angles[i] * DEG);
    cur = frames[i].copy(cur).multiply(_t).multiply(_r);
  }
  const flange = (out?.flange ?? new Matrix4()).copy(cur);
  const tcp = (out?.tcp ?? new Matrix4()).copy(flange).multiply(_t.makeTranslation(0, 0, cfg.tool.tcpOffset));
  return { frames, flange, tcp };
}

/** poziția TCP (coordonate celulă, mm) */
export function tcpPosition(m: Matrix4, out = new Vector3()): Vector3 {
  return out.setFromMatrixPosition(m);
}

/**
 * Construiește o poziție-țintă pentru sculă: origine `pos`, axa Z a sculei în jos (-Y),
 * axa X a sculei de-a lungul `xAxis` (proiectată pe orizontală).
 */
export function toolPoseDown(pos: Vec3, xAxis: [number, number, number] = [1, 0, 0]): Matrix4 {
  const z = new Vector3(0, -1, 0);
  const x = new Vector3(xAxis[0], 0, xAxis[2]).normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  const m = new Matrix4().makeBasis(x, y, z);
  m.setPosition(pos.x, pos.y, pos.z);
  return m;
}

/**
 * Conversie în convenția robot (Z în sus, ca la FANUC): X=x, Y=-z, Z=y.
 * Returnează poziția și unghiurile W,P,R (fixed XYZ: R = Rz(R)·Ry(P)·Rx(W)).
 */
export function toWPR(m: Matrix4): { x: number; y: number; z: number; w: number; p: number; r: number } {
  const C = new Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1); // three → z-up
  const Ct = C.clone().transpose();
  const R = new Matrix4().copy(m);
  R.setPosition(0, 0, 0);
  const Rz = new Matrix4().multiplyMatrices(C, R).multiply(Ct);
  const e = Rz.elements; // column-major: e[0]=r11 e[1]=r21 e[2]=r31 e[6]=r32 e[10]=r33
  const r31 = Math.max(-1, Math.min(1, e[2]));
  const p = -Math.asin(r31);
  const w = Math.atan2(e[6], e[10]);
  const r = Math.atan2(e[1], e[0]);
  const pos = new Vector3().setFromMatrixPosition(m);
  return { x: pos.x, y: -pos.z, z: pos.y, w: w / DEG, p: p / DEG, r: r / DEG };
}

/** inversul lui toWPR: din (X,Y,Z,W,P,R) în convenție Z-up → matrice în coordonate celulă */
export function fromWPR(v: { x: number; y: number; z: number; w: number; p: number; r: number }): Matrix4 {
  const C = new Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const Ct = C.clone().transpose();
  const Rz = new Matrix4()
    .makeRotationZ(v.r * DEG)
    .multiply(new Matrix4().makeRotationY(v.p * DEG))
    .multiply(new Matrix4().makeRotationX(v.w * DEG));
  const R = new Matrix4().multiplyMatrices(Ct, Rz).multiply(C);
  R.setPosition(v.x, v.z, -v.y);
  return R;
}

export function quatOf(m: Matrix4): Quaternion {
  return new Quaternion().setFromRotationMatrix(m);
}
