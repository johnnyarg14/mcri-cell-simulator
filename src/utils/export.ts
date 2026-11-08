import { engine } from '../sim/engine';

function download(filename: string, content: string | Blob, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/** export JSON: secvența încărcată + operațiile înregistrate (Gantt) */
export function exportSequenceJSON() {
  const data = {
    exportedAt: new Date().toISOString(),
    simTime: engine.t,
    sequence: engine.sequence,
    operations: engine.ops.map((o) => ({ ...o, end: o.end ?? engine.t })),
    metrics: { produced: engine.produced, rejected: engine.vision.rejected, palletsOut: engine.palletsOut, rateBpm: engine.rateBpm(), avgBpm: engine.avgBpm() },
  };
  download(`mcri_secventa_${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** export CSV: timpii de ciclu pe găleată */
export function exportCycleCSV() {
  const rows = engine.cycleRecords();
  const f = (v?: number) => (v === undefined ? '' : v.toFixed(2));
  const lines = ['id;nr;t_depal_s;t_etichetare_s;t_inspectie_s;t_repal_s;ciclu_total_s;rebut'];
  for (const r of rows) {
    const total = r.tRepal !== undefined && r.tDepal !== undefined ? r.tRepal - r.tDepal : undefined;
    lines.push([r.id, r.serial, f(r.tDepal), f(r.tLabel), f(r.tInspect), f(r.tRepal), f(total), r.reject ? 'DA' : 'NU'].join(';'));
  }
  lines.push('');
  lines.push(`# timp simulat;${engine.t.toFixed(1)} s`);
  lines.push(`# gaieti produse;${engine.produced}`);
  lines.push(`# rebuturi;${engine.vision.rejected}`);
  lines.push(`# paleti livrati;${engine.palletsOut}`);
  lines.push(`# debit mediu;${engine.avgBpm().toFixed(2)} gal/min`);
  lines.push(`# debit live (60 s);${engine.rateBpm().toFixed(2)} gal/min`);
  download(`mcri_timpi_ciclu_${stamp()}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
}

export function downloadPNG(dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `mcri_viewport_${stamp()}.png`;
  a.click();
}

/** import secvență JSON (fișier local) */
export function importSequenceFile(file: File, onDone: (ok: boolean, msg: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      const seq = json.sequence ?? json;
      if (!seq.robot1 || !seq.robot2 || !seq.stations) throw new Error('structură invalidă (lipsesc robot1/robot2/stations)');
      engine.setSequence(seq);
      onDone(true, `Secvență încărcată: ${file.name}`);
    } catch (e) {
      onDone(false, `Eroare la import: ${(e as Error).message}`);
    }
  };
  reader.readAsText(file);
}
