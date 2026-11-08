import { useRef } from 'react';
import { SIM } from '../config/cell.config';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import { exportCycleCSV, exportSequenceJSON, importSequenceFile } from '../utils/export';

const fmt = (t: number) => engine.fmtTime(t);

export function TopBar() {
  const { playing, speed, snapshot, play, pause, stop, stepOnce, reset, setSpeed, requestCapture, setStatus, setMode, setRightTab } = useSimStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const delta = snapshot.rateBpm - snapshot.targetBpm;
  const speeds = [0.25, 0.5, 1, 2, 4, 8];
  return (
    <div className="h-12 flex items-center gap-2 px-2 bg-ps-panel border-b border-ps-border shrink-0 whitespace-nowrap overflow-hidden">
      <div className="flex items-center gap-2 pr-2 border-r border-ps-border">
        <div className="w-7 h-7 rounded bg-[#0a4a8c] grid place-items-center font-bold text-[#f7b500] text-sm">M</div>
        <div className="leading-tight">
          <div className="font-semibold text-[13px]">MCRI Cell Simulator</div>
          <div className="text-[10px] text-ps-muted">Depal · Etichetare · Repal – găleți 5 gal</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className={`ps-btn ${playing ? 'ps-btn-active' : ''}`} onClick={play} title="Play (Space)">
          ▶ Play
        </button>
        <button className="ps-btn" onClick={pause} disabled={!playing} title="Pauză">
          ❚❚ Pause
        </button>
        <button className="ps-btn" onClick={stop} title="Stop (revine la 00:00)">
          ■ Stop
        </button>
        <button className="ps-btn" onClick={stepOnce} disabled={playing} title={`Step (+${SIM.stepTicks * SIM.dt} s)`}>
          ⏭ Step
        </button>
        <button className="ps-btn ml-1" onClick={reset} title="Reset simulare">
          ↺ Reset
        </button>
      </div>
      <div className="flex items-center gap-1 pl-3 border-l border-ps-border" title="Auto: secvența din sequence.json conduce roboții · Manual: jog + programe robot">
        <button className={`ps-btn ${snapshot.mode === 'auto' ? 'ps-btn-active' : ''}`} onClick={() => setMode('auto')}>
          Auto
        </button>
        <button
          className={`ps-btn ${snapshot.mode === 'manual' ? 'ps-btn-active' : ''}`}
          onClick={() => {
            setMode('manual');
            setRightTab('program');
          }}
        >
          Manual
        </button>
      </div>
      <div className="flex items-center gap-2 pl-3 border-l border-ps-border">
        <span className="text-ps-muted">Viteză</span>
        <input type="range" min={0} max={speeds.length - 1} step={1} value={speeds.indexOf(speed) < 0 ? 2 : speeds.indexOf(speed)} onChange={(e) => setSpeed(speeds[Number(e.target.value)])} className="w-28" />
        <span className="w-10 font-mono text-right">{speed}×</span>
      </div>
      <div className="flex items-center gap-3 pl-2 border-l border-ps-border font-mono">
        <div title="Ceas simulare">
          <span className="text-ps-muted font-sans">t </span>
          <span className="text-[15px] text-white">{fmt(snapshot.t)}</span>
        </div>
        <div title={`Debit live (fereastră 60 s) față de ținta ${snapshot.targetBpm} găleți/min`}>
          <span className="text-ps-muted font-sans">găleți/min </span>
          <span className={`text-[15px] ${delta >= -0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{snapshot.rateBpm.toFixed(1)}</span>
          <span className={`ml-1 text-[11px] ${delta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            Δ{delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}
          </span>
        </div>
        <div title="Găleți repaletizate">
          <span className="text-ps-muted font-sans">produse </span>
          <span className="text-[15px] text-white">{snapshot.produced}</span>
        </div>
        <div title="Rebuturi / paleți livrați" className="text-ps-muted font-sans text-[11px]">
          rebut <span className="text-red-400 font-mono">{snapshot.rejected}</span> · paleți <span className="text-white font-mono">{snapshot.palletsOut}</span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button className="ps-btn" onClick={requestCapture} title="Captură PNG a viewport-ului">
          📷 PNG
        </button>
        <button className="ps-btn" onClick={exportSequenceJSON} title="Export secvență + operații (JSON)">
          ⤓ JSON
        </button>
        <button className="ps-btn" onClick={exportCycleCSV} title="Export timpi de ciclu (CSV)">
          ⤓ CSV
        </button>
        <button className="ps-btn" onClick={() => fileRef.current?.click()} title="Import secvență JSON">
          ⤒ Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importSequenceFile(f, (_ok, msg) => setStatus(msg));
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
