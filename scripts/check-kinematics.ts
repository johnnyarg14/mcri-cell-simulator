import { ROBOT_1, ROBOT_2 } from '../src/config/cell.config';
import { forwardKinematics, toolPoseDown, toWPR } from '../src/kinematics/fk';
import { solveIK as _solveIK, solveIKRobust } from '../src/kinematics/ik';
const solveIK = (c: any, t: any, s: number[]) => solveIKRobust(c, t, s);
void _solveIK;

const fmt = (a: number[]) => a.map((v) => v.toFixed(1)).join(', ');

for (const cfg of [ROBOT_1, ROBOT_2]) {
  console.log(`\n=== ${cfg.name} ===`);
  const fk = forwardKinematics(cfg, cfg.home);
  console.log('HOME q =', fmt(cfg.home), '→ TCP', toWPR(fk.tcp));
  for (const tp of cfg.teachPoints) {
    const target = toolPoseDown(tp.pos, tp.xAxis);
    const t0 = performance.now();
    const r = solveIK(cfg, target, cfg.ikSeed);
    const dt = (performance.now() - t0).toFixed(1);
    const chk = toWPR(forwardKinematics(cfg, r.q).tcp);
    console.log(
      `${tp.name.padEnd(28)} conv=${r.converged} it=${r.iterations} pos=${r.posErr.toFixed(2)}mm rot=${r.rotErr.toFixed(2)}° ${dt}ms  q=[${fmt(r.q)}]  X=${chk.x.toFixed(0)} Y=${chk.y.toFixed(0)} Z=${chk.z.toFixed(0)} W=${chk.w.toFixed(0)} P=${chk.p.toFixed(0)} R=${chk.r.toFixed(0)}`,
    );
  }
}
// puncte de lucru reale: Robot 1 – rândurile paletului de la depal; Robot 2 – poziții pe palet repal
console.log('\n--- Robot 1: rânduri depal (nivel 1..3) ---');
for (const lvl of [0, 1, 2]) {
  const y = 508 + 140 + (lvl + 1) * 370 + lvl * 4;
  for (const x of [-305, 0, 305]) {
    const r = solveIK(ROBOT_1, toolPoseDown({ x: -1700 + x, y, z: -1700 }, [0, 0, 1]), ROBOT_1.ikSeed);
    console.log(`nivel ${lvl + 1} rând x=${x}: conv=${r.converged} pos=${r.posErr.toFixed(2)} q=[${fmt(r.q)}]`);
  }
}
console.log('--- Robot 1: depunere B1 ---');
{
  const r = solveIK(ROBOT_1, toolPoseDown({ x: 7.5, y: 762 + 370, z: 1500 }, [1, 0, 0]), ROBOT_1.ikSeed);
  console.log(`drop B1: conv=${r.converged} pos=${r.posErr.toFixed(2)} q=[${fmt(r.q)}]`);
}
console.log('\n--- Robot 2: poziții palet repal (nivel 1 și 3) ---');
for (const lvl of [0, 2]) {
  const y = 508 + 140 + (lvl + 1) * 370 + lvl * 4;
  for (const [x, z] of [
    [-305, -457.5],
    [305, 457.5],
    [0, 0],
  ]) {
    const r = solveIK(ROBOT_2, toolPoseDown({ x: -1700 + x, y, z: 4400 + z }, [1, 0, 0]), ROBOT_2.ikSeed);
    console.log(`nivel ${lvl + 1} (${x},${z}): conv=${r.converged} pos=${r.posErr.toFixed(2)} rot=${r.rotErr.toFixed(2)} q=[${fmt(r.q)}]`);
  }
}
