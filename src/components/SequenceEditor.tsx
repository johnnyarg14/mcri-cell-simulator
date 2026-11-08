import { useEffect, useRef, useState } from 'react';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import type { Op } from '../sim/types';

const LABEL_W = 170;
const ROW_H = 22;
const HEADER_H = 20;

/** Sequence Editor – Gantt pe resurse, cursor de timp, zoom, click = salt la operație */
export function SequenceEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const collapsed = useSimStore((s) => s.bottomCollapsed);
  const setFlag = useSimStore((s) => s.setFlag);
  const [pxPerSec, setPxPerSec] = useState(12);
  const [follow, setFollow] = useState(true);
  const [scroll, setScroll] = useState(0); // secunde la marginea stângă
  const scrollRef = useRef(0);
  const [hover, setHover] = useState<Op | null>(null);
  scrollRef.current = scroll;
  const resources = engine.sequence.resources;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      const wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const W = wrap.clientWidth;
      const H = HEADER_H + resources.length * ROW_H;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = engine.t;
      const span = (W - LABEL_W) / pxPerSec;
      let s0 = scrollRef.current;
      if (follow && (t > s0 + span * 0.85 || t < s0)) {
        s0 = Math.max(0, t - span * 0.6);
        scrollRef.current = s0;
        setScroll(s0);
      }
      const x = (tt: number) => LABEL_W + (tt - s0) * pxPerSec;
      ctx.fillStyle = '#1b1d21';
      ctx.fillRect(0, 0, W, H);
      // grilă timp
      const stepS = pxPerSec >= 40 ? 1 : pxPerSec >= 12 ? 5 : pxPerSec >= 4 ? 15 : 60;
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.textBaseline = 'middle';
      for (let tt = Math.floor(s0 / stepS) * stepS; tt < s0 + span + stepS; tt += stepS) {
        const xx = x(tt);
        if (xx < LABEL_W) continue;
        ctx.strokeStyle = tt % 60 === 0 ? '#3a3f47' : '#2a2e34';
        ctx.beginPath();
        ctx.moveTo(xx, HEADER_H);
        ctx.lineTo(xx, H);
        ctx.stroke();
        ctx.fillStyle = '#8b919b';
        ctx.fillText(engine.fmtTime(tt).slice(0, 5), xx + 3, HEADER_H / 2);
      }
      // rânduri
      resources.forEach((r, i) => {
        const y = HEADER_H + i * ROW_H;
        ctx.fillStyle = i % 2 ? '#1f2227' : '#1b1d21';
        ctx.fillRect(LABEL_W, y, W - LABEL_W, ROW_H);
        ctx.fillStyle = '#24272c';
        ctx.fillRect(0, y, LABEL_W, ROW_H);
        ctx.fillStyle = r.color;
        ctx.fillRect(0, y, 4, ROW_H);
        ctx.fillStyle = '#d7dae0';
        ctx.fillText(r.name, 10, y + ROW_H / 2);
      });
      // operații – cu sub-benzi pentru suprapuneri în aceeași resursă
      const tEndVis = s0 + span;
      const laneEnd: number[][] = resources.map(() => []);
      const visible = engine.ops.filter((op) => (op.end ?? t) >= s0 && op.start <= tEndVis);
      for (const op of visible) {
        const end = op.end ?? t;
        const i = resources.findIndex((r) => r.id === op.resource);
        if (i < 0) continue;
        const lanes = laneEnd[i];
        let lane = lanes.findIndex((e) => e <= op.start + 1e-6);
        if (lane < 0) {
          lane = Math.min(lanes.length, 2);
          if (lanes.length < 3) lanes.push(end);
        }
        lanes[lane] = Math.max(lanes[lane] ?? 0, end);
        const nL = Math.max(1, Math.min(3, lanes.length));
        const lh = (ROW_H - 6) / nL;
        const y = HEADER_H + i * ROW_H + 3 + lane * lh;
        const x0 = Math.max(LABEL_W, x(op.start));
        const x1 = Math.min(W, x(end));
        const w = Math.max(1.5, x1 - x0);
        ctx.fillStyle = op.color;
        ctx.globalAlpha = op.end === undefined ? 0.95 : 0.8;
        ctx.fillRect(x0, y, w, lh - 1);
        ctx.globalAlpha = 1;
        if (hover === op) {
          ctx.strokeStyle = '#fff';
          ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, lh - 2);
        }
        if (w > 40 && nL === 1) {
          ctx.fillStyle = '#111';
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y, w, lh - 1);
          ctx.clip();
          ctx.fillText(op.name, x0 + 3, y + (lh - 1) / 2);
          ctx.restore();
        }
      }
      // cursor timp
      const xc = x(t);
      if (xc >= LABEL_W) {
        ctx.strokeStyle = '#ff5c5c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xc, 0);
        ctx.lineTo(xc, H);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#ff5c5c';
        ctx.beginPath();
        ctx.moveTo(xc - 5, 0);
        ctx.lineTo(xc + 5, 0);
        ctx.lineTo(xc, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#24272c';
      ctx.fillRect(0, 0, LABEL_W, HEADER_H);
      ctx.fillStyle = '#8b919b';
      ctx.fillText('Resursă / timp', 10, HEADER_H / 2);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [pxPerSec, follow, resources, hover]);

  const opAt = (ev: React.MouseEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    if (px < LABEL_W || py < HEADER_H) return null;
    const i = Math.floor((py - HEADER_H) / ROW_H);
    const res = resources[i];
    if (!res) return null;
    const tt = scrollRef.current + (px - LABEL_W) / pxPerSec;
    let best: Op | null = null;
    for (const op of engine.ops) {
      if (op.resource !== res.id) continue;
      const end = op.end ?? engine.t;
      if (tt >= op.start && tt <= end) best = op;
    }
    return best;
  };

  const onClick = (ev: React.MouseEvent) => {
    const op = opAt(ev);
    if (!op) return;
    const { pause, refresh, setStatus } = useSimStore.getState();
    pause();
    engine.jumpTo(op.start + 0.01);
    refresh();
    setStatus(`Salt la ${engine.fmtTime(op.start)} – ${op.name}`);
  };

  const onWheel = (ev: React.WheelEvent) => {
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      setPxPerSec((p) => Math.max(1, Math.min(120, p * (ev.deltaY < 0 ? 1.2 : 1 / 1.2))));
    } else {
      setFollow(false);
      const span = ((wrapRef.current?.clientWidth ?? 800) - LABEL_W) / pxPerSec;
      setScroll((s) => Math.max(0, s + (ev.deltaY > 0 ? 1 : -1) * span * 0.15));
    }
  };

  void collapsed;
  void setFlag;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-2 h-7 border-b border-ps-border bg-ps-panel2">
        <span className="text-ps-muted">Gantt pe resurse · click pe operație = salt în simulare · Ctrl+scroll = zoom</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-ps-muted">Zoom</span>
          <input type="range" min={1} max={120} step={1} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="w-28" />
          <span className="font-mono w-16 whitespace-nowrap">{pxPerSec.toFixed(0)} px/s</span>
          <button className={`ps-btn ${follow ? 'ps-btn-active' : ''}`} onClick={() => setFollow(!follow)}>
            Urmărește
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 overflow-hidden relative" onWheel={onWheel}>
        <canvas
          ref={canvasRef}
          className="block cursor-pointer"
          onClick={onClick}
          onMouseMove={(e) => setHover(opAt(e))}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div className="absolute right-2 top-1 bg-ps-bg/90 border border-ps-border rounded px-2 py-1 text-[11px] pointer-events-none">
            <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: hover.color }} />
            <b>{hover.name}</b> · {engine.fmtTime(hover.start)} → {engine.fmtTime(hover.end ?? engine.t)} ({((hover.end ?? engine.t) - hover.start).toFixed(1)} s)
          </div>
        )}
      </div>
    </div>
  );
}
