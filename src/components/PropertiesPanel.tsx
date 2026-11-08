import { useEffect, useMemo, useState } from 'react';
import { BUCKET_LINE, FENCE, PALLET_LINE, ROBOTS, SAFETY, STATIONS } from '../config/cell.config';
import { fromWPR, toolPoseDown } from '../kinematics/fk';
import { engine } from '../sim/engine';
import { useSimStore } from '../store/useSimStore';
import { buildObjectTree, findNode } from '../scene/objects';
import { ProgramPanel } from './ProgramPanel';
import { ModelEditor, ModelsPanel } from './ModelsPanel';
import { useModelStore } from '../store/useModelStore';

function Row({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="ps-row border-b border-ps-border/40">
      <span className="text-ps-muted">{k}</span>
      <span className={mono ? 'font-mono' : ''}>{v}</span>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="ps-title">{title}</div>
      <div>{children}</div>
    </div>
  );
}
const Led = ({ on, color = '#30d158' }: { on: boolean; color?: string }) => <span className="led" style={{ background: on ? color : '#444' }} />;

// --------------------------------------------------------------------------- Robot
function RobotProps({ id }: { id: string }) {
  const cfg = ROBOTS.find((r) => r.id === id)!;
  const snap = useSimStore((s) => s.snapshot.robots.find((r) => r.id === id));
  const pause = useSimStore((s) => s.pause);
  const playing = useSimStore((s) => s.playing);
  const [target, setTarget] = useState({ x: 0, y: 0, z: 0, w: 180, p: 0, r: 0 });
  const [teachName, setTeachName] = useState('');
  const [, force] = useState(0);
  useEffect(() => {
    if (snap) setTarget({ x: +snap.tcp.x.toFixed(1), y: +snap.tcp.y.toFixed(1), z: +snap.tcp.z.toFixed(1), w: +snap.tcp.w.toFixed(1), p: +snap.tcp.p.toFixed(1), r: +snap.tcp.r.toFixed(1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!snap) return null;
  const rt = engine.robots[id];
  const onJoint = (i: number, v: number) => {
    if (playing) pause();
    engine.setJoint(id, i, v);
    useSimStore.getState().refresh();
  };
  const jog = () => {
    if (playing) pause();
    engine.jogTo(id, fromWPR(target));
    useSimStore.getState().refresh();
  };
  const jogTeach = (pos: { x: number; y: number; z: number }, xAxis: [number, number, number]) => {
    if (playing) pause();
    engine.jogTo(id, toolPoseDown(pos, xAxis));
    useSimStore.getState().refresh();
  };
  const jogQ = (q: number[]) => {
    if (playing) pause();
    q.forEach((v, i) => engine.setJoint(id, i, v));
    useSimStore.getState().refresh();
  };
  return (
    <>
      <Section title="Robot">
        <Row k="Model" v={cfg.model} mono={false} />
        <Row k="Axe / sarcină / rază" v={`${cfg.axes} / ${cfg.payloadKg} kg / ${cfg.reach} mm`} />
        <Row k="Montaj" v={cfg.mount.name} mono={false} />
        <Row k="Bază (X,Y,Z)" v={`${cfg.base.x}, ${cfg.base.y}, ${cfg.base.z}`} />
        <Row k="Stare" v={<span className={snap.manual ? 'text-amber-400' : 'text-emerald-400'}>{snap.manual ? 'MANUAL (jog)' : snap.state}</span>} mono={false} />
        <Row k="Operație" v={snap.currentOp ?? '–'} mono={false} />
        <Row k="Transportă" v={`${snap.carrying} produs(e)`} />
        <Row k="Coliziune" v={snap.collision ? <span className="text-red-400">{snap.collision}</span> : <span className="text-emerald-400">nu</span>} mono={false} />
      </Section>
      <Section title={`Axe J1–J${cfg.axes} (limite catalog)`}>
        {cfg.joints.map((j, i) => (
          <div key={j.name} className="px-2 py-1 border-b border-ps-border/40">
            <div className="flex justify-between text-[11px]">
              <span>
                {j.name} <span className="text-ps-muted">[{j.min}°, {j.max}°] · {j.speed}°/s</span>
              </span>
              <span className="font-mono">{snap.q[i].toFixed(1)}°</span>
            </div>
            <input type="range" min={j.min} max={j.max} step={0.1} value={snap.q[i]} onChange={(e) => onJoint(i, Number(e.target.value))} className="w-full" />
          </div>
        ))}
        <div className="px-2 py-1 text-[10px] text-ps-muted">Mișcarea sliderelor pune robotul în mod manual și oprește secvența; Play reia automat.</div>
      </Section>
      <Section title="TCP (cinematică directă) – convenție Z în sus, W P R fixed XYZ">
        <div className="grid grid-cols-3 gap-x-2 px-2 py-1 font-mono text-[11px]">
          {(['x', 'y', 'z', 'w', 'p', 'r'] as const).map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-ps-muted uppercase">{k}</span>
              <span>
                {snap.tcp[k].toFixed(1)}
                {k === 'x' || k === 'y' || k === 'z' ? '' : '°'}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Jog to target (cinematică inversă DLS)">
        <div className="grid grid-cols-3 gap-1 px-2 py-1">
          {(['x', 'y', 'z', 'w', 'p', 'r'] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 text-[11px]">
              <span className="text-ps-muted uppercase w-3">{k}</span>
              <input className="ps-input" type="number" step={k.length === 1 && 'xyz'.includes(k) ? 10 : 5} value={target[k]} onChange={(e) => setTarget({ ...target, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <div className="flex gap-1 px-2 pb-1">
          <button className="ps-btn flex-1" onClick={jog}>
            ⤳ Jog to target
          </button>
          <button
            className="ps-btn"
            onClick={() => {
              setTarget({ x: +snap.tcp.x.toFixed(1), y: +snap.tcp.y.toFixed(1), z: +snap.tcp.z.toFixed(1), w: +snap.tcp.w.toFixed(1), p: +snap.tcp.p.toFixed(1), r: +snap.tcp.r.toFixed(1) });
            }}
            title="Copiază TCP curent"
          >
            ⟲ TCP
          </button>
        </div>
        {snap.ikInfo && <div className="px-2 pb-1 text-[10px] text-ps-muted">{snap.ikInfo}</div>}
      </Section>
      <Section title="Puncte învățate">
        {cfg.teachPoints.map((tp) => (
          <div key={tp.name} className="ps-row border-b border-ps-border/40 hover:bg-white/5 cursor-pointer" onClick={() => jogTeach(tp.pos, tp.xAxis)} title="Jog (IK) la acest punct">
            <span>{tp.name}</span>
            <span className="font-mono text-ps-muted text-[10px]">
              {tp.pos.x}, {-tp.pos.z}, {tp.pos.y}
            </span>
          </div>
        ))}
        {rt?.teach.map((tp, i) => (
          <div key={i} className="ps-row border-b border-ps-border/40 hover:bg-white/5 cursor-pointer" onClick={() => jogQ(tp.q)} title="Mută în această configurație de axe">
            <span>★ {tp.name}</span>
            <span className="font-mono text-ps-muted text-[10px]">[{tp.q.map((v) => v.toFixed(0)).join(', ')}]</span>
          </div>
        ))}
        <div className="flex gap-1 px-2 py-1">
          <input className="ps-input" placeholder="Nume punct nou" value={teachName} onChange={(e) => setTeachName(e.target.value)} />
          <button
            className="ps-btn"
            onClick={() => {
              engine.teachCurrent(id, teachName || `P${(rt?.teach.length ?? 0) + 1}`);
              setTeachName('');
              force((n) => n + 1);
            }}
          >
            + Învață
          </button>
        </div>
      </Section>
      <Section title="Lanț cinematic (config)">
        {cfg.chain.map((l) => (
          <Row key={l.id} k={l.id} v={`t=(${l.translate.join(', ')}) ax=(${l.axis.join(',')})`} />
        ))}
      </Section>
    </>
  );
}

// --------------------------------------------------------------------------- Conveior găleți
function ConveyorProps({ id }: { id: string }) {
  const cfg = BUCKET_LINE.conveyors.find((c) => c.id === id)!;
  const st = useSimStore((s) => s.snapshot.conveyors.find((c) => c.id === id));
  if (!st) return null;
  const setMode = (m: 'run' | 'stop' | 'accumulate') => {
    engine.setConveyorMode(id, m);
    useSimStore.getState().refresh();
  };
  return (
    <>
      <Section title="Conveior găleți">
        <Row k="BF / TOR" v={`${BUCKET_LINE.bf} / ${BUCKET_LINE.tor} mm`} />
        <Row k="Lungime traseu" v={`${st.length.toFixed(0)} mm`} />
        <Row k="Găleți pe conveior" v={st.count} />
        <Row k="Următorul" v={cfg.next ?? '– (capăt)'} />
        <div className="px-2 py-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-ps-muted">Viteză</span>
            <span className="font-mono">{st.speed.toFixed(0)} mm/s</span>
          </div>
          <input
            type="range"
            min={0}
            max={600}
            step={10}
            value={st.speed}
            onChange={(e) => {
              engine.setConveyorSpeed(id, Number(e.target.value));
              useSimStore.getState().refresh();
            }}
            className="w-full"
          />
        </div>
        <div className="flex gap-1 px-2 py-1">
          {(['run', 'stop', 'accumulate'] as const).map((m) => (
            <button key={m} className={`ps-btn flex-1 ${st.mode === m ? 'ps-btn-active' : ''}`} onClick={() => setMode(m)}>
              {m === 'run' ? 'Run' : m === 'stop' ? 'Stop' : 'Accumulate'}
            </button>
          ))}
        </div>
      </Section>
      <Section title={`Opritoare pneumatice PCS19 (${st.stops.length})`}>
        {st.stops.length === 0 && <div className="px-2 py-1 text-ps-muted">–</div>}
        {st.stops.map((s) => (
          <div key={s.id} className="ps-row border-b border-ps-border/40">
            <span className="flex items-center gap-2">
              <Led on={s.kind === 'reject' ? false : s.active} color="#ff9f1a" />
              {s.name}
            </span>
            <span className="font-mono text-ps-muted">
              s={s.s.toFixed(0)} · {s.kind === 'reject' ? 'rebut' : s.active ? 'închis' : 'deschis'}
            </span>
          </div>
        ))}
      </Section>
      <Section title={`Fotocelule (${st.photocells.length})`}>
        {st.photocells.length === 0 && <div className="px-2 py-1 text-ps-muted">–</div>}
        {st.photocells.map((p) => (
          <div key={p.id} className="ps-row border-b border-ps-border/40">
            <span className="flex items-center gap-2">
              <Led on={p.blocked} color="#e5484d" />
              {p.name}
            </span>
            <span className="font-mono text-ps-muted">
              s={p.s.toFixed(0)} · {p.blocked ? 'OCUPAT' : 'liber'}
            </span>
          </div>
        ))}
      </Section>
    </>
  );
}

function PalletLineProps({ zoneId }: { zoneId?: string }) {
  const pl = useSimStore((s) => s.snapshot.palletLine);
  const zone = zoneId ? PALLET_LINE.zones.find((z) => z.id === zoneId) : undefined;
  return (
    <>
      <Section title={zone ? 'Secțiune CDLR' : 'Linie paleți CDLR'}>
        {zone && <Row k="Rol" v={zone.role} />}
        {zone && <Row k="Z0 → Z1" v={`${zone.z0} → ${zone.z1}`} />}
        <Row k="BF / TOR" v={`${PALLET_LINE.bf} / ${PALLET_LINE.tor} mm`} />
        <Row k="Role" v={`Ø${PALLET_LINE.rollerDia} @ ${PALLET_LINE.rollerPitch} mm`} />
        <div className="px-2 py-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-ps-muted">Viteză</span>
            <span className="font-mono">{pl.speed.toFixed(0)} mm/s</span>
          </div>
          <input
            type="range"
            min={0}
            max={400}
            step={10}
            value={pl.speed}
            onChange={(e) => {
              engine.setPalletLineSpeed(Number(e.target.value));
              useSimStore.getState().refresh();
            }}
            className="w-full"
          />
        </div>
        <div className="flex gap-1 px-2 py-1">
          {(['run', 'stop', 'accumulate'] as const).map((m) => (
            <button
              key={m}
              className={`ps-btn flex-1 ${pl.mode === m ? 'ps-btn-active' : ''}`}
              onClick={() => {
                engine.setPalletLineMode(m);
                useSimStore.getState().refresh();
              }}
            >
              {m === 'run' ? 'Run' : m === 'stop' ? 'Stop' : 'Accumulate'}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Zone (ocupare)">
        {pl.zones.map((z) => (
          <div key={z.id} className={`ps-row border-b border-ps-border/40 ${z.id === zoneId ? 'bg-ps-accent/15' : ''}`}>
            <span className="flex items-center gap-2">
              <Led on={!!z.occupant} color="#3b9cff" />
              {z.id.replace('CDLR_', '')} <span className="text-ps-muted">{z.role}</span>
            </span>
            <span className="font-mono text-ps-muted">{z.occupant ? z.occupant.replace('PAL_', 'Palet ') : 'liber'}</span>
          </div>
        ))}
      </Section>
    </>
  );
}

function StationProps({ id }: { id: string }) {
  const st = useSimStore((s) => s.snapshot.stations);
  const S = STATIONS;
  switch (id) {
    case S.labeler.id:
      return (
        <Section title="Etichetator">
          <Row k="Poziție (X,Z)" v={`${S.labeler.pos.x}, ${S.labeler.pos.z}`} />
          <Row k="Timp etichetare" v={`${engine.sequence.stations.labeler.duration} s`} />
          <Row k="Stare" v={<span className={st.labeler.busy ? 'text-amber-400' : 'text-emerald-400'}>{st.labeler.busy ? 'ETICHETARE' : 'gata'}</span>} mono={false} />
          <Row k="Etichete aplicate" v={st.labeler.count} />
        </Section>
      );
    case S.vision.id:
      return (
        <Section title="Inspecție vizuală">
          <Row k="Hotă" v={`${S.vision.length} × ${S.vision.width}, boltă la ${S.vision.archH}`} />
          <Row k="Camere" v="1 sus + 2 laterale" mono={false} />
          <Row k="Timp inspecție" v={`${engine.sequence.stations.vision.duration} s`} />
          <Row k="Rată rebut" v={`1 din ${engine.sequence.stations.vision.rejectEvery}`} />
          <Row k="Stare" v={<span className={st.vision.busy ? 'text-amber-400' : 'text-emerald-400'}>{st.vision.busy ? 'INSPECȚIE' : 'gata'}</span>} mono={false} />
          <Row k="Inspectate / respinse" v={`${st.vision.inspected} / ${st.vision.rejected}`} />
        </Section>
      );
    case S.pusher.id:
    case S.chute.id:
      return (
        <Section title="Pusher rebut & tobogan">
          <Row k="Cursă pusher" v={`${S.pusher.stroke} mm`} />
          <Row k="Timp extindere/retragere" v={`${S.pusher.extendS} / ${S.pusher.retractS} s`} />
          <Row k="Găleți în container rebut" v={st.rejectBin} />
        </Section>
      );
    case S.wrapper.id:
      return (
        <Section title="Infoliator Wulftec">
          <Row k="Masă rotativă" v={`Ø${S.wrapper.turntableDia}, ${S.wrapper.rpm} rpm`} />
          <Row k="Catarg" v={`H ${S.wrapper.mast.h}`} />
          <Row k="Ciclu înfoliere" v={`${engine.sequence.stations.wrapper.duration} s`} />
          <Row k="Stare" v={<span className={st.wrapper.busy ? 'text-amber-400' : 'text-emerald-400'}>{st.wrapper.busy ? `ÎNFOLIERE ${(st.wrapper.progress * 100).toFixed(0)}%` : 'liber'}</span>} mono={false} />
          <Row k="Paleți înfoliați" v={st.wrapper.count} />
        </Section>
      );
    case S.sheetMagazine.id:
      return (
        <Section title="Magazie foi intermediare">
          <Row k="Platformă / montanți" v={`${S.sheetMagazine.platformH} / ${S.sheetMagazine.guidePostH}`} />
          <Row k="Foi disponibile" v={st.sheetMagazine} />
        </Section>
      );
    case S.sheetWasteBin.id:
      return (
        <Section title="Container foi uzate">
          <Row k="Dimensiuni" v={`${S.sheetWasteBin.size.w} × ${S.sheetWasteBin.size.d} × ${S.sheetWasteBin.size.h}`} />
          <Row k="Foi colectate" v={st.sheetBin} />
        </Section>
      );
  }
  return null;
}

function ProductProps({ id }: { id: string }) {
  useSimStore((s) => s.snapshot.tick);
  const p = engine.products.get(id);
  if (!p) return <div className="px-2 py-2 text-ps-muted">Produsul a părăsit celula.</div>;
  return (
    <Section title={p.kind === 'bucket' ? 'Găleată 5 gal' : p.kind === 'sheet' ? 'Foaie intermediară' : 'Palet GMA'}>
      <Row k="ID" v={p.id} />
      <Row k="Stare" v={p.state} />
      <Row k="Poziție (mm)" v={`${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`} />
      {p.conveyor && <Row k="Conveior / s" v={`${p.conveyor} / ${p.s?.toFixed(0)}`} />}
      {p.kind === 'bucket' && <Row k="Etichetată / inspectată" v={`${p.labeled ? 'da' : 'nu'} / ${p.inspected ? (p.reject ? 'REBUT' : 'OK') : 'nu'}`} />}
      {p.kind === 'bucket' && p.tDepal !== undefined && <Row k="t depal / repal" v={`${p.tDepal.toFixed(1)} / ${p.tRepal?.toFixed(1) ?? '–'} s`} />}
      {p.kind === 'pallet' && <Row k="Zonă" v={PALLET_LINE.zones[p.zone ?? 0]?.id} />}
      {p.kind === 'pallet' && <Row k="Produse pe palet" v={p.children?.length ?? 0} />}
    </Section>
  );
}

function StaticProps({ id, name }: { id: string; name: string }) {
  if (id === 'FENCE')
    return (
      <Section title="Gard de protecție">
        <Row k="Perimetru" v={`${FENCE.x1 - FENCE.x0} × ${FENCE.z1 - FENCE.z0}`} />
        <Row k="Stâlpi" v={`${FENCE.postSize} × ${FENCE.postSize} @ ${FENCE.postPitch}`} />
        <Row k="Panouri" v={`h ${FENCE.panelHeight}`} />
        <Row k="Deschideri" v={FENCE.openings.length} />
      </Section>
    );
  const lc = SAFETY.lightCurtains.find((l) => l.id === id);
  if (lc)
    return (
      <Section title="Barieră optică">
        <Row k="Deschidere" v={`${lc.span} mm`} />
        <Row k="Înălțime protejată" v={`${lc.height} mm`} />
      </Section>
    );
  const st = useSimStore.getState().snapshot.conveyors.flatMap((c) => [...c.stops, ...c.photocells]).find((x) => x.id === id);
  if (st)
    return (
      <Section title={name}>
        <Row k="Abscisă s" v={`${st.s.toFixed(0)} mm`} />
        <Row k="Stare" v={'active' in st ? (st.active ? 'închis' : 'deschis') : (st as { blocked: boolean }).blocked ? 'OCUPAT' : 'liber'} />
      </Section>
    );
  return (
    <Section title={name}>
      <div className="px-2 py-1 text-ps-muted">Obiect static definit în cell.config.ts.</div>
    </Section>
  );
}

function ModelProps({ id }: { id: string }) {
  const m = useModelStore((s) => s.models.find((x) => x.id === id));
  if (!m) return null;
  return (
    <Section title="Model CAD importat">
      <ModelEditor m={m} />
    </Section>
  );
}

export function PropertiesPanel() {
  const selectedId = useSimStore((s) => s.selectedId);
  const rightTab = useSimStore((s) => s.rightTab);
  const setRightTab = useSimStore((s) => s.setRightTab);
  const customModel = useModelStore((s) => (selectedId ? s.models.find((m) => m.id === selectedId) : undefined));
  const tree = useMemo(() => buildObjectTree(), []);
  const node = selectedId ? findNode(tree, selectedId) : null;
  const name = node?.name ?? customModel?.name ?? (selectedId ? engine.products.get(selectedId)?.id : undefined) ?? selectedId ?? '';
  let body: React.ReactNode = <div className="px-2 py-3 text-ps-muted">Selectează un obiect din Object Tree sau din scenă.</div>;
  if (selectedId) {
    if (ROBOTS.some((r) => r.id === selectedId || r.tool.id === selectedId)) body = <RobotProps id={ROBOTS.find((r) => r.id === selectedId || r.tool.id === selectedId)!.id} />;
    else if (BUCKET_LINE.conveyors.some((c) => c.id === selectedId)) body = <ConveyorProps id={selectedId} />;
    else if (selectedId === 'PALLET_LINE') body = <PalletLineProps />;
    else if (PALLET_LINE.zones.some((z) => z.id === selectedId)) body = <PalletLineProps zoneId={selectedId} />;
    else if (Object.values(STATIONS).some((s) => s.id === selectedId)) body = <StationProps id={selectedId} />;
    else if (/^(BKT|SHT|PAL)_/.test(selectedId)) body = <ProductProps id={selectedId} />;
    else if (selectedId.startsWith('MODEL_')) body = <ModelProps id={selectedId} />;
    else body = <StaticProps id={selectedId} name={name} />;
  }
  const tabs: { id: typeof rightTab; label: string }[] = [
    { id: 'props', label: 'Proprietăți' },
    { id: 'program', label: 'Program' },
    { id: 'models', label: 'Modele CAD' },
  ];
  return (
    <div className="w-[340px] shrink-0 flex flex-col bg-ps-panel border-l border-ps-border">
      <div className="flex border-b border-ps-border bg-ps-panel2">
        {tabs.map((t) => (
          <button key={t.id} className={`flex-1 px-2 py-1 text-[11px] uppercase tracking-wider font-semibold ${rightTab === t.id ? 'text-white border-b-2 border-ps-accent' : 'text-ps-muted hover:text-ps-text'}`} onClick={() => setRightTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {rightTab === 'props' && (
        <>
          <div className="ps-title flex items-center justify-between">
            <span>Obiect</span>
            <span className="normal-case tracking-normal text-ps-text truncate max-w-[220px]" title={name}>
              {name}
            </span>
          </div>
          <div className="flex-1 overflow-auto text-xs">{body}</div>
        </>
      )}
      {rightTab === 'program' && <div className="flex-1 overflow-auto">{<ProgramPanel />}</div>}
      {rightTab === 'models' && <div className="flex-1 overflow-auto">{<ModelsPanel />}</div>}
    </div>
  );
}
