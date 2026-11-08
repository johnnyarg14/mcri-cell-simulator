import { Engine } from '../src/sim/engine';

const e = new Engine();
const T = Number(process.argv[2] ?? 900);
const t0 = performance.now();
let lastReport = 0;
while (e.t < T) {
  e.step();
  if (e.t - lastReport >= 60) {
    lastReport = e.t;
    const b1 = e.conveyors.CONV_B1.count;
    const b3 = e.conveyors.CONV_B3.count;
    console.log(
      `t=${e.fmtTime()}  produse=${e.produced}  rebut=${e.vision.rejected}  paleți=${e.palletsOut}  rată=${e.rateBpm().toFixed(1)}/min  medie=${e.avgBpm().toFixed(1)}/min  B1=${b1} B3=${b3}  R1=${e.robots.ROBOT_1.state}  R2=${e.robots.ROBOT_2.state}  produse în scenă=${e.products.size}`,
    );
  }
}
console.log(`\nsimulare ${T}s în ${(performance.now() - t0).toFixed(0)} ms (${e.tick} pași); ops=${e.ops.length}`);
console.log('ultimele mesaje:');
for (const m of e.messages.slice(-8)) console.log(' ', m);
const coll = Object.values(e.robots).map((r) => `${r.cfg.id}: ${r.collision ?? '-'}`);
console.log('coliziuni la final:', coll.join(' | '));
console.log('cicluri:', e.cycleRecords().slice(0, 3));
// determinism: jumpTo
const e2 = new Engine();
e2.jumpTo(300);
const e3 = new Engine();
e3.advance(300);
console.log('determinism jumpTo(300) == advance(300):', e2.produced === e3.produced && e2.products.size === e3.products.size, e2.produced, e3.produced);
