import { Engine } from '../src/sim/engine';
import { solveIKRobust } from '../src/kinematics/ik';
import { toolPoseDown } from '../src/kinematics/fk';

// test mod manual: program Robot 2 – ia găleată de pe B3 și o pune pe paletul de la S7
const e = new Engine();
e.setMode('manual');
e.spawnBucketOnConveyor('CONV_B3', 100);
e.advance(40); // găleata ajunge la opritorul de capăt
const b = [...e.products.values()].find((p) => p.kind === 'bucket' && p.conveyor === 'CONV_B3')!;
console.log('găleată la capăt B3:', b.s?.toFixed(0), 'blocked=', b.blocked);
const r2 = e.robots.ROBOT_2;
const pick = solveIKRobust(r2.cfg, toolPoseDown({ x: b.x, y: b.y + 370, z: b.z }, [1, 0, 0]), r2.q).q;
const prePick = solveIKRobust(r2.cfg, toolPoseDown({ x: b.x, y: b.y + 370 + 250, z: b.z }, [1, 0, 0]), pick).q;
const place = solveIKRobust(r2.cfg, toolPoseDown({ x: -1700, y: 508 + 140 + 370, z: 4400 }, [1, 0, 0]), pick).q;
const prePlace = solveIKRobust(r2.cfg, toolPoseDown({ x: -1700, y: 508 + 140 + 370 + 250, z: 4400 }, [1, 0, 0]), place).q;
e.setProgram('ROBOT_2', {
  loop: false,
  speed: 100,
  steps: [
    { id: '1', kind: 'move', name: 'pre-pick', q: prePick },
    { id: '2', kind: 'move', name: 'pick', q: pick },
    { id: '3', kind: 'grip', name: 'prindere', dwell: 0.3 },
    { id: '4', kind: 'move', name: 'pre-pick', q: prePick },
    { id: '5', kind: 'move', name: 'pre-place', q: prePlace },
    { id: '6', kind: 'move', name: 'place', q: place },
    { id: '7', kind: 'release', name: 'eliberare', dwell: 0.3 },
    { id: '8', kind: 'move', name: 'pre-place', q: prePlace },
  ],
});
e.startProgram('ROBOT_2');
e.advance(30);
console.log('stare R2:', r2.state, '| produse:', e.produced, '| găleată:', b.state, 'palet=', b.palletId, 'y=', b.y.toFixed(0));
console.log('ops R2:', e.ops.filter((o) => o.resource === 'ROBOT_2').map((o) => o.name).join(' → '));
// prindere manuală directă (R1) peste rândul de sus al paletului de la depal
const r1 = e.robots.ROBOT_1;
const q = solveIKRobust(r1.cfg, toolPoseDown({ x: -1700 + 305, y: 508 + 140 + 3 * 370 + 8, z: -1700 }, [0, 0, 1]), r1.q).q;
q.forEach((v, i) => e.setJoint('ROBOT_1', i, v));
console.log('R1 manualGrip →', e.manualGrip('ROBOT_1'), 'produse prinse');
const qd = solveIKRobust(r1.cfg, toolPoseDown({ x: 7.5, y: 762 + 370, z: 1500 }, [1, 0, 0]), r1.q).q;
qd.forEach((v, i) => e.setJoint('ROBOT_1', i, v));
console.log('R1 manualRelease →', e.manualRelease('ROBOT_1'), 'produse eliberate; pe B1:', [...e.products.values()].filter((p) => p.conveyor === 'CONV_B1').length);
e.setMode('auto');
e.advance(60);
console.log('revenire auto: produse=', e.produced, 'R1=', r1.state, 'R2=', r2.state);
