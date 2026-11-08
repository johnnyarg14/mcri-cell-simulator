import { useRef, useState } from 'react';
import { ROBOTS } from '../config/cell.config';
import { engine } from '../sim/engine';
import type { ProgramStep, RobotProgram } from '../sim/types';
import { useSimStore } from '../store/useSimStore';

const uid = () => Math.random().toString(36).slice(2, 8);

/** Program robot (mod manual): locații învățate + prindere / eliberare / așteptare, rulare în buclă */
export function ProgramPanel() {
  const selectedId = useSimStore((s) => s.selectedId);
  const snapshot = useSimStore((s) => s.snapshot);
  const playing = useSimStore((s) => s.playing);
  const { play, setMode, select, refresh, setStatus } = useSimStore();
  const robotFromSel = ROBOTS.find((r) => r.id === selectedId || r.tool.id === selectedId)?.id;
  const [robotId, setRobotId] = useState(robotFromSel ?? 'ROBOT_1');
  const rid = robotFromSel ?? robotId;
  const cfg = ROBOTS.find((r) => r.id === rid)!;
  const rt = engine.robots[rid];
  const snap = snapshot.robots.find((r) => r.id === rid)!;
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const program = rt.program;

  const commit = (p: RobotProgram) => {
    engine.setProgram(rid, p);
    force((n) => n + 1);
  };
  const addStep = (st: Omit<ProgramStep, 'id'>) => commit({ ...program, steps: [...program.steps, { id: uid(), ...st }] });
  const update = (id: string, patch: Partial<ProgramStep>) => commit({ ...program, steps: program.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const remove = (id: string) => commit({ ...program, steps: program.steps.filter((s) => s.id !== id) });
  const move = (i: number, d: number) => {
    const steps = program.steps.slice();
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    commit({ ...program, steps });
  };
  const ensureManual = () => {
    if (snapshot.mode !== 'manual') setMode('manual');
  };
  const jogToQ = (q: number[]) => {
    ensureManual();
    q.forEach((v, i) => engine.setJoint(rid, i, v));
    refresh();
  };
  const fmtQ = (q: number[]) => q.map((v) => v.toFixed(0)).join(', ');

  return (
    <div className="text-xs">
      <div className="ps-title flex items-center gap-2">
        <span>Program robot</span>
        <select
          className="ps-input w-auto normal-case tracking-normal"
          value={rid}
          onChange={(e) => {
            setRobotId(e.target.value);
            select(e.target.value);
          }}
        >
          {ROBOTS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id === 'ROBOT_1' ? 'Robot 1 – M-410iC/315' : 'Robot 2 – M-20iB/25'}
            </option>
          ))}
        </select>
      </div>
      <div className="px-2 py-1 flex items-center gap-1 flex-wrap">
        <span className="text-ps-muted">Mod:</span>
        <button className={`ps-btn ${snapshot.mode === 'auto' ? 'ps-btn-active' : ''}`} onClick={() => setMode('auto')}>
          Auto (secvență)
        </button>
        <button className={`ps-btn ${snapshot.mode === 'manual' ? 'ps-btn-active' : ''}`} onClick={() => setMode('manual')}>
          Manual
        </button>
      </div>
      <div className="px-2 py-1 text-[10px] text-ps-muted">
        În modul Manual roboții sunt conduși de tine: jog din tabul Proprietăți, apoi „+ Locație” adaugă poziția curentă a axelor. Prinderea ia produsele de sub sculă, eliberarea le așază pe conveior / palet / pardoseală.
      </div>

      <div className="ps-title">Comenzi directe</div>
      <div className="px-2 py-1 grid grid-cols-2 gap-1">
        <button
          className="ps-btn"
          onClick={() => {
            ensureManual();
            engine.manualGrip(rid);
            refresh();
          }}
        >
          🧲 Prinde acum
        </button>
        <button
          className="ps-btn"
          onClick={() => {
            ensureManual();
            engine.manualRelease(rid);
            refresh();
          }}
        >
          ⤓ Eliberează acum
        </button>
        <button className="ps-btn" onClick={() => jogToQ(cfg.home)}>
          ⌂ HOME
        </button>
        <button
          className="ps-btn"
          onClick={() => {
            engine.spawnFullPallet();
            refresh();
          }}
        >
          + Palet plin la S1
        </button>
        <button
          className="ps-btn"
          onClick={() => {
            engine.spawnEmptyPallet('repal');
            refresh();
          }}
        >
          + Palet gol la S7
        </button>
        <button
          className="ps-btn"
          onClick={() => {
            engine.spawnBucketOnConveyor('CONV_B1', 150);
            refresh();
          }}
        >
          + Găleată pe B1
        </button>
        <button
          className="ps-btn col-span-2"
          onClick={() => {
            if (confirm('Elimini toate produsele din celulă?')) {
              engine.clearProducts();
              refresh();
            }
          }}
        >
          🗑 Golește celula de produse
        </button>
      </div>

      <div className="ps-title flex items-center justify-between">
        <span>Pași ({program.steps.length})</span>
        <span className="normal-case tracking-normal">
          {snap.programRunning ? (
            <span className="text-emerald-400">rulează · pas {snap.programIdx + 1} · ciclu {snap.programCycles + 1}</span>
          ) : (
            <span className="text-ps-muted">oprit</span>
          )}
        </span>
      </div>
      <div className="max-h-[260px] overflow-auto">
        {program.steps.length === 0 && <div className="px-2 py-2 text-ps-muted">Niciun pas. Mută robotul (jog / Jog to target) și apasă „+ Locație”.</div>}
        {program.steps.map((st, i) => (
          <div key={st.id} className={`px-2 py-1 border-b border-ps-border/40 ${snap.programRunning && snap.programIdx === i ? 'bg-ps-accent/20' : ''}`}>
            <div className="flex items-center gap-1">
              <span className="w-5 text-ps-muted font-mono">{i + 1}</span>
              <span className="w-4">{st.kind === 'move' ? '⤳' : st.kind === 'grip' ? '🧲' : st.kind === 'release' ? '⤓' : '⏱'}</span>
              <input className="ps-input flex-1" value={st.name} onChange={(e) => update(st.id, { name: e.target.value })} />
              {st.kind === 'move' && (
                <button className="ps-btn" title="Mută robotul în această locație" onClick={() => jogToQ(st.q!)}>
                  ▶
                </button>
              )}
              {st.kind === 'move' && (
                <button className="ps-btn" title="Actualizează locația cu poziția curentă" onClick={() => update(st.id, { q: rt.q.slice() })}>
                  ⟲
                </button>
              )}
              <button className="ps-btn" onClick={() => move(i, -1)} title="Sus">
                ▲
              </button>
              <button className="ps-btn" onClick={() => move(i, 1)} title="Jos">
                ▼
              </button>
              <button className="ps-btn" onClick={() => remove(st.id)} title="Șterge">
                ✕
              </button>
            </div>
            <div className="pl-6 text-[10px] text-ps-muted font-mono flex items-center gap-2">
              {st.kind === 'move' && <span>q = [{fmtQ(st.q!)}]</span>}
              {st.kind === 'move' && (
                <label className="flex items-center gap-1">
                  viteză
                  <input className="ps-input w-12" type="number" min={1} max={200} value={st.speed ?? 100} onChange={(e) => update(st.id, { speed: Number(e.target.value) })} />%
                </label>
              )}
              {st.kind !== 'move' && (
                <label className="flex items-center gap-1">
                  durată
                  <input className="ps-input w-14" type="number" min={0} step={0.1} value={st.dwell ?? (st.kind === 'wait' ? 1 : 0.3)} onChange={(e) => update(st.id, { dwell: Number(e.target.value) })} />s
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-2 py-1 grid grid-cols-2 gap-1">
        <button className="ps-btn" onClick={() => addStep({ kind: 'move', name: `Locație ${program.steps.filter((s) => s.kind === 'move').length + 1}`, q: rt.q.slice(), speed: 100 })}>
          + Locație (poziția curentă)
        </button>
        <button className="ps-btn" onClick={() => addStep({ kind: 'grip', name: 'Prindere', dwell: 0.4 })}>
          + Prindere
        </button>
        <button className="ps-btn" onClick={() => addStep({ kind: 'release', name: 'Eliberare', dwell: 0.3 })}>
          + Eliberare
        </button>
        <button className="ps-btn" onClick={() => addStep({ kind: 'wait', name: 'Așteptare', dwell: 1 })}>
          + Așteptare
        </button>
      </div>
      <div className="px-2 py-1 flex items-center gap-2">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={program.loop} onChange={(e) => commit({ ...program, loop: e.target.checked })} /> buclă
        </label>
        <label className="flex items-center gap-1 flex-1">
          <span className="text-ps-muted">viteză</span>
          <input type="range" min={10} max={200} value={program.speed} onChange={(e) => commit({ ...program, speed: Number(e.target.value) })} className="flex-1" />
          <span className="font-mono w-10">{program.speed}%</span>
        </label>
      </div>
      <div className="px-2 py-1 flex gap-1">
        <button
          className="ps-btn flex-1 ps-btn-active"
          disabled={program.steps.length === 0 || snap.programRunning}
          onClick={() => {
            engine.startProgram(rid);
            if (!playing) play();
            refresh();
            setStatus(`Program ${cfg.name} pornit`);
          }}
        >
          ▶ Rulează programul
        </button>
        <button
          className="ps-btn"
          disabled={!snap.programRunning}
          onClick={() => {
            engine.stopProgram(rid);
            refresh();
          }}
        >
          ■ Oprește
        </button>
        <button
          className="ps-btn"
          title="Export program JSON"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ robot: rid, program }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `program_${rid}.json`;
            a.click();
          }}
        >
          ⤓
        </button>
        <button className="ps-btn" title="Import program JSON" onClick={() => fileRef.current?.click()}>
          ⤒
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            f.text().then((txt) => {
              try {
                const j = JSON.parse(txt);
                const p = (j.program ?? j) as RobotProgram;
                if (!Array.isArray(p.steps)) throw new Error('lipsește steps');
                commit({ steps: p.steps, loop: !!p.loop, speed: p.speed ?? 100 });
                setStatus(`Program importat: ${f.name}`);
              } catch (err) {
                setStatus(`Import eșuat: ${(err as Error).message}`);
              }
            });
            e.target.value = '';
          }}
        />
        <button
          className="ps-btn"
          title="Șterge programul"
          onClick={() => {
            if (confirm('Ștergi toți pașii programului?')) commit({ ...program, steps: [] });
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
