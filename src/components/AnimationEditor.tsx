import { useEffect, useRef, useState } from 'react';
import { ROBOTS } from '../config/cell.config';
import { engine } from '../sim/engine';
import { readTransform } from '../scene/AnimDriver';
import { buildObjectTree, findNode } from '../scene/objects';
import { useAnimStore, type AnimationData } from '../store/useAnimStore';
import { useModelStore } from '../store/useModelStore';
import { useSimStore } from '../store/useSimStore';

const LABEL_W = 190;
const ROW_H = 22;
const HEADER_H = 20;

function nameOf(id: string): string {
  const m = useModelStore.getState().models.find((x) => x.id === id);
  if (m) return m.name;
  const n = findNode(buildObjectTree(), id);
  if (n) return n.name;
  return id;
}

/** Editor de animație pe cadre: piste per obiect, chei, playhead, scrub */
export function AnimationEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anim = useAnimStore();
  const selectedId = useSimStore((s) => s.selectedId);
  const select = useSimStore((s) => s.select);
  const setStatus = useSimStore((s) => s.setStatus);
  const [pxPerFrame, setPx] = useState(4);
  const [scroll, setScroll] = useState(0);
  const dragKey = useRef<{ id: string; from: number } | null>(null);
  const scrubbing = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // editorul activ conduce scena cât timp tabul este deschis
  useEffect(() => {
    anim.setActive(true);
    return () => anim.setActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = (() => {
    const ids = anim.tracks.map((t) => t.id);
    if (selectedId && !ids.includes(selectedId)) ids.push(selectedId);
    return ids;
  })();

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      const wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const s = useAnimStore.getState();
      const W = wrap.clientWidth;
      const H = HEADER_H + Math.max(rows.length, 1) * ROW_H;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = (f: number) => LABEL_W + (f - scroll) * pxPerFrame;
      ctx.fillStyle = '#1b1d21';
      ctx.fillRect(0, 0, W, H);
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.textBaseline = 'middle';
      const step = pxPerFrame >= 12 ? 1 : pxPerFrame >= 4 ? 5 : pxPerFrame >= 1.5 ? 25 : 100;
      for (let f = Math.floor(scroll / step) * step; f <= s.length; f += step) {
        const xx = x(f);
        if (xx < LABEL_W) continue;
        if (xx > W) break;
        const major = f % s.fps === 0;
        ctx.strokeStyle = major ? '#3a3f47' : '#262a30';
        ctx.beginPath();
        ctx.moveTo(xx, HEADER_H);
        ctx.lineTo(xx, H);
        ctx.stroke();
        if (major || pxPerFrame >= 12) {
          ctx.fillStyle = '#8b919b';
          ctx.fillText(major ? `${f} (${(f / s.fps).toFixed(1)}s)` : String(f), xx + 2, HEADER_H / 2);
        }
      }
      // sfârșit animație
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (x(s.length) < W) ctx.fillRect(x(s.length), HEADER_H, W - x(s.length), H - HEADER_H);
      rows.forEach((id, i) => {
        const y = HEADER_H + i * ROW_H;
        ctx.fillStyle = i % 2 ? '#1f2227' : '#1b1d21';
        ctx.fillRect(LABEL_W, y, W - LABEL_W, ROW_H);
        ctx.fillStyle = id === selectedId ? '#2a3a52' : '#24272c';
        ctx.fillRect(0, y, LABEL_W, ROW_H);
        ctx.fillStyle = '#d7dae0';
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, LABEL_W - 4, ROW_H);
        ctx.clip();
        ctx.fillText(nameOf(id), 8, y + ROW_H / 2);
        ctx.restore();
        const t = s.tracks.find((tr) => tr.id === id);
        if (!t) return;
        // segmente între chei
        for (let k = 0; k < t.keys.length - 1; k++) {
          ctx.strokeStyle = '#4f6b8f';
          ctx.beginPath();
          ctx.moveTo(x(t.keys[k].frame), y + ROW_H / 2);
          ctx.lineTo(x(t.keys[k + 1].frame), y + ROW_H / 2);
          ctx.stroke();
        }
        for (const k of t.keys) {
          const kx = x(k.frame);
          if (kx < LABEL_W - 6 || kx > W + 6) continue;
          ctx.fillStyle = Math.round(s.frame) === k.frame ? '#ffd43b' : '#4dabf7';
          ctx.beginPath();
          ctx.moveTo(kx, y + 5);
          ctx.lineTo(kx + 5, y + ROW_H / 2);
          ctx.lineTo(kx, y + ROW_H - 5);
          ctx.lineTo(kx - 5, y + ROW_H / 2);
          ctx.closePath();
          ctx.fill();
        }
      });
      // playhead
      const xc = x(s.frame);
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
      ctx.fillText('Obiect / cadru', 8, HEADER_H / 2);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [pxPerFrame, scroll, rows, selectedId]);

  const hit = (ev: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const frame = scroll + (px - LABEL_W) / pxPerFrame;
    const row = py < HEADER_H ? -1 : Math.floor((py - HEADER_H) / ROW_H);
    const id = rows[row];
    const t = id ? anim.tracks.find((tr) => tr.id === id) : undefined;
    const key = t?.keys.find((k) => Math.abs(k.frame - frame) * pxPerFrame <= 6);
    return { px, py, frame, row, id, key };
  };

  const onMouseDown = (ev: React.MouseEvent) => {
    const h = hit(ev);
    if (h.px < LABEL_W) {
      if (h.id) select(h.id);
      return;
    }
    if (h.key && h.id) {
      dragKey.current = { id: h.id, from: h.key.frame };
      anim.setFrame(h.key.frame);
      select(h.id);
      return;
    }
    scrubbing.current = true;
    anim.pause();
    anim.setFrame(Math.max(0, Math.round(h.frame)));
  };
  const onMouseMove = (ev: React.MouseEvent) => {
    if (dragKey.current) {
      const h = hit(ev);
      const to = Math.max(0, Math.round(h.frame));
      if (to !== dragKey.current.from) {
        anim.moveKey(dragKey.current.id, dragKey.current.from, to);
        dragKey.current.from = to;
        anim.setFrame(to);
      }
    } else if (scrubbing.current) {
      const h = hit(ev);
      anim.setFrame(Math.max(0, Math.round(h.frame)));
    }
  };
  const onMouseUp = () => {
    dragKey.current = null;
    scrubbing.current = false;
  };
  const onWheel = (ev: React.WheelEvent) => {
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      setPx((p) => Math.max(0.25, Math.min(40, p * (ev.deltaY < 0 ? 1.2 : 1 / 1.2))));
    } else setScroll((s) => Math.max(0, s + (ev.deltaY > 0 ? 1 : -1) * 20));
  };

  const addKeyForSelected = () => {
    if (!selectedId) {
      setStatus('Selectează un obiect (model importat sau robot) pentru a adăuga o cheie');
      return;
    }
    const f = Math.round(anim.frame);
    if (ROBOTS.some((r) => r.id === selectedId)) {
      anim.addKey(selectedId, nameOf(selectedId), { frame: f, q: engine.robots[selectedId].q.slice() });
    } else {
      const t = readTransform(selectedId);
      if (!t) {
        setStatus('Obiectul nu este în scenă');
        return;
      }
      anim.addKey(selectedId, nameOf(selectedId), { frame: f, ...t });
    }
    setStatus(`Cheie adăugată: ${nameOf(selectedId)} @ cadru ${f}`);
  };
  const curTrack = selectedId ? anim.tracks.find((t) => t.id === selectedId) : undefined;
  const curKey = curTrack?.keys.find((k) => k.frame === Math.round(anim.frame));
  const frameInt = Math.round(anim.frame);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-2 h-7 border-b border-ps-border bg-ps-panel2 whitespace-nowrap overflow-hidden">
        <button className="ps-btn" onClick={() => anim.setFrame(0)} title="Început">
          ⏮
        </button>
        <button className="ps-btn" onClick={() => anim.setFrame(frameInt - 1)} title="Cadru anterior (,)">
          ◀
        </button>
        <button className={`ps-btn ${anim.playing ? 'ps-btn-active' : ''}`} onClick={() => (anim.playing ? anim.pause() : anim.play())} title="Redare animație">
          {anim.playing ? '❚❚' : '▶'}
        </button>
        <button className="ps-btn" onClick={() => anim.setFrame(frameInt + 1)} title="Cadru următor (.)">
          ▶|
        </button>
        <span className="ml-1 text-ps-muted">cadru</span>
        <input className="ps-input !w-16 font-mono" type="number" min={0} max={anim.length} value={frameInt} onChange={(e) => anim.setFrame(Number(e.target.value))} />
        <span className="font-mono text-ps-muted">/ {anim.length} · {(anim.frame / anim.fps).toFixed(2)} s</span>
        <span className="ml-2 text-ps-muted">fps</span>
        <input className="ps-input !w-12" type="number" min={1} max={120} value={anim.fps} onChange={(e) => e.target.value !== '' && anim.setFps(Number(e.target.value))} />
        <span className="text-ps-muted">lungime</span>
        <input className="ps-input !w-16" type="number" min={1} value={anim.length} onChange={(e) => e.target.value !== '' && anim.setLength(Number(e.target.value))} />
        <label className="flex items-center gap-1 ml-1">
          <input type="checkbox" checked={anim.loop} onChange={(e) => anim.setLoop(e.target.checked)} /> buclă
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={anim.smooth} onChange={(e) => anim.setSmooth(e.target.checked)} /> lin
        </label>
        <label className="flex items-center gap-1" title="Adaugă automat o cheie când muți obiectul cu gizmo">
          <input type="checkbox" checked={anim.autoKey} onChange={(e) => anim.setAutoKey(e.target.checked)} /> auto-key
        </label>
        <span className="w-px h-5 bg-ps-border mx-1" />
        <button className="ps-btn ps-btn-active" onClick={addKeyForSelected} title="Cheie la cadrul curent pentru obiectul selectat (K)">
          ◆ + Cheie
        </button>
        <button className="ps-btn" disabled={!curKey} onClick={() => selectedId && anim.removeKey(selectedId, frameInt)} title="Șterge cheia de la cadrul curent">
          ◇ − Cheie
        </button>
        <button className="ps-btn" disabled={!curTrack} onClick={() => selectedId && confirm('Ștergi toată pista obiectului?') && anim.removeTrack(selectedId)} title="Șterge pista">
          ✕ Pistă
        </button>
        <div className="ml-auto flex items-center gap-1">
          <input type="range" min={0.25} max={40} step={0.25} value={pxPerFrame} onChange={(e) => setPx(Number(e.target.value))} className="w-20" title="Zoom" />
          <button
            className="ps-btn"
            title="Export animație JSON"
            onClick={() => {
              const blob = new Blob([JSON.stringify(anim.toJSON(), null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'animatie.json';
              a.click();
            }}
          >
            ⤓
          </button>
          <button className="ps-btn" title="Import animație JSON" onClick={() => fileRef.current?.click()}>
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
                  const d = JSON.parse(txt) as AnimationData;
                  if (!Array.isArray(d.tracks)) throw new Error('lipsește tracks');
                  anim.load(d);
                  setStatus(`Animație importată: ${f.name}`);
                } catch (err) {
                  setStatus(`Import eșuat: ${(err as Error).message}`);
                }
              });
              e.target.value = '';
            }}
          />
          <button className="ps-btn" title="Șterge toate cheile" onClick={() => confirm('Ștergi toată animația?') && anim.clear()}>
            🗑
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 overflow-auto relative" onWheel={onWheel}>
        <canvas ref={canvasRef} className="block cursor-crosshair" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
        {rows.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-ps-muted pointer-events-none text-center">
            Selectează un obiect în scenă, mută-l (gizmo sau tabul Modele CAD) și apasă „+ Cheie”.
            <br />
            Pentru roboți: setează axele din Proprietăți, apoi „+ Cheie”. Scrub: click/drag în timeline.
          </div>
        )}
      </div>
    </div>
  );
}
