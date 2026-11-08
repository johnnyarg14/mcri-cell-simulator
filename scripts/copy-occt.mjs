// copiază runtime-ul OpenCascade (WASM) în public/occt – încărcat la cerere pentru conversia STEP/IGES/BREP
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const src = resolve('node_modules/occt-import-js/dist');
const dst = resolve('public/occt');
if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
for (const f of ['occt-import-js.js', 'occt-import-js.wasm', 'license.occt.txt', 'license.occt-import-js.txt']) copyFileSync(resolve(src, f), resolve(dst, f));
console.log('occt-import-js copiat în public/occt');
