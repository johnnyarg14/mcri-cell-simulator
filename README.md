# MCRI Cell Simulator

Simulator de celulă robotizată în stil Siemens Process Simulate, realizat ca aplicație web statică (fără backend).
Modelează celula **MCRI de depaletizare / repaletizare găleți de 5 gal** cu etichetare inline și inspecție vizuală, țintă **10 găleți/min**
(referință: clip Motion Controls Robotics, YouTube `SWpIWw1aGKk`), dar permite și construirea unei **celule proprii din modele CAD** și
**animarea ei cadru cu cadru**.

Lucrare de licență – UPB FIIR, Mecatronică și Robotică.

**Aplicația online:** https://johnnyarg14.github.io/mcri-cell-simulator/

![MCRI Cell Simulator](docs/screenshot.png)

## Cuprins

1. [Pornire rapidă](#pornire-rapidă)
2. [Interfața – toate funcțiile](#interfața--toate-funcțiile)
3. [Tutorial A – simularea celulei MCRI](#tutorial-a--simularea-celulei-mcri)
4. [Tutorial B – simulare manuală (program robot, teach pendant)](#tutorial-b--simulare-manuală-program-robot-teach-pendant)
5. [Tutorial C – celulă proprie din modele CAD](#tutorial-c--celulă-proprie-din-modele-cad)
6. [Tutorial D – animație cadru cu cadru](#tutorial-d--animație-cadru-cu-cadru)
7. [Tutorial E – import și conversie CAD (STEP, STL, …)](#tutorial-e--import-și-conversie-cad-step-stl-)
8. [Tutorial F – export pentru lucrare și salvarea proiectului](#tutorial-f--export-pentru-lucrare-și-salvarea-proiectului)
9. [Scurtături de tastatură](#scurtături-de-tastatură)
10. [Instalare și rulare](#instalare-și-rulare) · [Structura proiectului](#structura-proiectului) · [Scena](#scena-primitive-parametrizate) · [Cinematică](#cinematică) · [Simulare](#simulare) · [Secvența](#secvența-srcconfigsequencejson) · [Modele CAD permanente](#modele-cad-step--gltf) · [Publicare](#publicare-pe-github-pages) · [Limitări](#limitări-cunoscute-mockup)

---

## Pornire rapidă

1. Deschide https://johnnyarg14.github.io/mcri-cell-simulator/ (sau local `npm install && npm run dev`).
2. Apasă **▶ Play**. Robotul 1 depaletizează rând cu rând, gălețile pleacă pe conveior spre etichetator și inspecție, Robotul 2 le repaletizează, paletul plin merge la infoliator.
3. Crește viteza la **8×**, urmărește debitul **găleți/min** din bara de sus și operațiile din **Sequence Editor** (Gantt).
4. Click pe un obiect în 3D sau în **Object Tree** → proprietățile lui apar în dreapta.

Totul se salvează în browser (programe, animație, modele importate); pentru a muta lucrul pe alt calculator folosește **Salvează proiect**.

## Interfața – toate funcțiile

### Bara de sus
| Element | Funcție |
| --- | --- |
| **Celula MCRI / Celulă goală** | Comută între celula completă din `cell.config.ts` și o pardoseală goală pentru propriile modele CAD. |
| **▶ Play · ❚❚ Pause · ■ Stop · ⏭ Step** | Rulează / oprește simularea; Stop revine la 00:00; Step avansează 0,1 s (5 pași de 20 ms). |
| **↺ Reset** | Reface starea inițială (paleți la S1/S3, palet gol la S7). |
| **Auto / Manual** | Auto: roboții urmează `sequence.json`. Manual: roboții sunt conduși de tine (jog + programe). |
| **Viteză** | 0,25× … 8× timp real. |
| **t** | Ceasul simulării `mm:ss.d`. |
| **găleți/min** | Debit live pe ultimele 60 s și diferența Δ față de ținta (10/min). Verde = la țintă, galben = deficit. |
| **produse · rebut · paleți** | Găleți repaletizate, respinse la inspecție, paleți livrați. |
| **📷 PNG** | Captură a viewport-ului 3D. |
| **⤓ JSON / ⤓ CSV** | Export secvență + operații înregistrate / timpi de ciclu (vezi Tutorial F). |
| **⤒ Import** | Încarcă o secvență JSON editată (sau exportată anterior). |

### Panoul stâng – Object Tree
Foldere **Roboți / Conveioare / Echipamente / Produse / Siguranță** (în celula goală: doar **Modele CAD importate**, cu ierarhia părinte → copil).
Click = selectare + chenar portocaliu în 3D; **👁** ascunde/afișează obiectul; ▸/▾ expandează. Folderul Produse se actualizează live
(paleți, găleți cu ✓ = etichetată, REBUT, foi).

### Viewport 3D
| Buton | Funcție |
| --- | --- |
| **Iso / Sus / Față / Lateral** | Vederi presetate. Mouse: rotire (stânga), pan (dreapta), zoom (scroll). |
| **Wire** | Wireframe pe toată scena. |
| **Colizii** | Detecție coliziuni gripper ↔ structuri (gard, ghidaje, stații…): gripper roșu, corpul lovit încadrat, mesaj în bara de stare. |
| **Reach** | Anvelopa de lucru a roboților (sferă + cerc la sol cu raza din catalog). |
| **Grilă** | Grila de pardoseală la 1 m (secțiuni la 5 m). |
| **Gizmo: Mută (G) / Rotește (E) / Scară / Oprit** | Manipulator 3D pentru modelul CAD selectat (snap 10 mm / 5°). |
| **Gizmo axe** (colț dreapta-jos) | Orientarea axelor; click pe o axă aliniază camera. |
| Drag & drop fișiere | Importă modele CAD direct în scenă (Tutorial E). |

### Panoul drept – tab **Proprietăți**
- **Robot**: model, axe/sarcină/rază, stare, operația curentă, produse transportate, coliziune; **slidere J1–Jn** cu limitele și vitezele din catalog
  (mișcarea lor pune robotul în mod manual); **TCP** (X Y Z W P R, convenție Z în sus) din cinematica directă; **Jog to target** – introduci X Y Z W P R
  și robotul ajunge acolo prin cinematică inversă (mesaj de convergență / punct inaccesibil); **Puncte învățate** din config (click = jog) și
  puncte proprii (**+ Învață** memorează axele curente); lanțul cinematic.
- **Conveior găleți**: BF/TOR, lungime, găleți pe conveior, slider viteză, **Run / Stop / Accumulate**, lista **opritoarelor PCS19** (LED închis/deschis)
  și a **fotocelulelor** (LED ocupat/liber).
- **Linie paleți CDLR**: viteză, mod, ocuparea celor 10 zone.
- **Stații**: etichetator (timp, stare, etichete aplicate), inspecție (timp, rată rebut, inspectate/respinse), pusher/tobogan, infoliator (progres),
  magazie foi, container foi uzate.
- **Produse**: id, stare, poziție, conveior/abscisă, etichetată/inspectată, timpi de depal/repal.
- **Model CAD importat**: nume, atribuire, părinte, scară, poziție, rotație, vizibilitate, descărcare GLB.

### Panoul drept – tab **Program** (mod manual)
Selector robot, comutator Auto/Manual, **comenzi directe** (Prinde acum, Eliberează acum, HOME, + palet plin la S1, + palet gol la S7, + găleată pe B1,
golire celulă), **lista pașilor** programului (▶ mută robotul la locație, ⟲ actualizează locația cu poziția curentă, ▲▼ reordonare, ✕ ștergere,
viteză % per locație, durată pentru prindere/eliberare/așteptare), butoane **+ Locație / + Prindere / + Eliberare / + Așteptare**,
**buclă**, **viteză globală**, **▶ Rulează programul / ■ Oprește**, export/import JSON, ștergere program.

### Panoul drept – tab **Modele CAD**
**Salvează / Deschide proiect** (`.mcri.json`), selector „Atribuie la” (înlocuiește un obiect existent sau plasare liberă), zonă de drag & drop /
selectare fișiere (STEP, STP, IGES, BREP, STL, OBJ, PLY, 3MF, DAE, FBX, GLB, GLTF), lista modelelor importate cu editor complet, export **manifest.json**.

### Panoul de jos
- **Sequence Editor** (celula MCRI): Gantt cu o bandă per resursă (Robot 1, Robot 2, CDLR paleți, B1, B3, etichetator, vision, infoliator),
  operații colorate (cu sub-benzi la suprapuneri), cursor de timp, zoom (slider / Ctrl+scroll), **Urmărește**, tooltip cu durata,
  **click pe o operație = salt determinist al simulării la momentul ei**.
- **Animație (cadre)**: editorul de keyframes (Tutorial D).
- ▾ pliază panoul.

### Bara de stare
FPS, numărul de corpuri din scenă, pași simulați, obiectul selectat, ultimul mesaj (evenimente ale celulei, erori IK, coliziuni cu ⚠).

---

## Tutorial A – simularea celulei MCRI

1. **Celula MCRI** + **Auto** (implicite). Apasă **▶ Play**.
2. Fluxul: paletul plin de la **S3** este depaletizat de **Robot 1** (un rând de 4 găleți pe ciclu, foile intermediare merg în container) → gălețile
   pleacă pe **B1** prin tunel → **etichetator** (2 s) → **inspecție vizuală** (1,5 s; 1 din 25 respinsă → pusher → tobogan) → curba **B2** → **B3**
   retur → **Robot 2** repaletizează pe paletul gol de la **S7** (foaie intermediară între niveluri) → palet plin → **S8** → **infoliator** (60 s) → ieșire.
   Paletul golit la S3 se transferă automat la S7, iar un palet plin nou apare la S1 după 30 s.
3. **Modifică parametrii din aplicație**: selectează un conveior → viteză / Run / Stop / Accumulate; selectează un robot → jog pe axe (simularea
   trece în pauză, Play o reia).
4. **Modifică procesul din JSON**: editează `src/config/sequence.json` (durate pași, timpi stații, `rejectEvery`) și reîncarcă, sau **⤒ Import**.
   Layout-ul, vitezele și cotele sunt în `src/config/cell.config.ts`.
5. **Analizează**: Gantt-ul arată așteptările (benzi gri), click pe orice operație sare exact acolo; **CSV** dă timpii de ciclu pe găleată.
6. **Coliziuni**: nu apar în secvența automată; testează cu Jog to target (ex. Robot 1 → X 2600, Y −1500, Z 800, W 90, P 0, R 90).

## Tutorial B – simulare manuală (program robot, teach pendant)

1. Apasă **Manual** (bara de sus) – se deschide tabul **Program**. Roboții nu mai urmează secvența; conveioarele și stațiile funcționează normal.
2. Populează celula dacă e nevoie: **+ Palet plin la S1**, **+ Palet gol la S7**, **+ Găleată pe B1**.
3. Selectează robotul (selectorul din tab sau click pe el). În tabul **Proprietăți** adu-l deasupra produsului: slidere J1–Jn sau **Jog to target**
   (ex. Robot 2 deasupra găleții de la capătul B3: X −100, Y −3100, Z 1132 + 250). Revino în **Program** → **+ Locație** (pre-pick).
4. Coboară (Z cu 250 mm mai jos) → **+ Locație** (pick) → **+ Prindere**.
5. Ridică → **+ Locație**; mergi deasupra paletului (ex. X −1700, Y −4400, Z 1300) → **+ Locație**; coboară → **+ Locație** → **+ Eliberare**;
   retrage → **+ Locație**.
6. **▶ Rulează programul**; bifează **buclă** pentru ciclu continuu și reglează **viteza %**. Pasul curent se evidențiază, Gantt-ul înregistrează pașii.
7. Corecturi: ▶ lângă un pas mută robotul acolo; ⟲ rescrie locația cu poziția curentă; ▲▼ reordonează. Programul se salvează automat în browser;
   ⤓ / ⤒ export/import JSON.
8. Reguli de prindere/eliberare: **Prindere** ia tot ce este sub sculă (rândul de găleți sub placa de strat a Robotului 1; o găleată sau o foaie sub
   gripperul cu 4 ventuze al Robotului 2; foaia de deasupra magaziei). **Eliberare** așază produsul pe conveior (dacă e deasupra lui), pe palet
   (peste produsul de dedesubt – nivelurile se formează singure) sau îl lasă să cadă pe pardoseală / în containerul de foi.
   Un palet umplut manual cu 36 de găleți este considerat complet și pleacă spre infoliator.
9. **Auto** readuce secvența automată (roboții își reiau sarcinile din starea curentă).

## Tutorial C – celulă proprie din modele CAD

1. Apasă **Celulă goală**. Rămâne pardoseala cu grila de 1 m; tabul **Modele CAD** se deschide automat.
2. Trage fișierele CAD (`.stp`, `.stl`, …) peste viewport sau folosește zona de import. Fiecare model apare la origine, în **Object Tree**.
3. **Poziționare**: selectează modelul (click în 3D sau în arbore) și mută-l cu **gizmo** (G mutare, E rotire, snap 10 mm / 5°) sau numeric
   (Poziție X Y Z în mm, Rotație în grade). Pentru CAD cu Z în sus apasă **Z↑**. Verifică **scara** (STEP = mm; STL/OBJ fără unități → mm / m / inch).
4. **Ierarhie** (pentru mecanisme): la piesa copil alege **Părinte**. Poziția/rotația copilului devin relative la părinte și se mută odată cu el.
   Un robot din CAD: bază (fix) → braț (părinte: bază) → antebraț (părinte: braț) → sculă (părinte: antebraț). Pivotul rotației este originea
   fiecărui model, deci exportă piesele din CAD cu originea pe axa articulației (sau compensează din Poziție).
5. **Vizibilitate** (👁) pentru variante de layout; **✕** șterge modelul; **⤓** descarcă GLB-ul convertit.
6. Salvează totul cu **💾 Salvează proiect** (un singur fișier `.mcri.json` cu modelele încorporate) – vezi Tutorial F.

Poți folosi modelele și în **celula MCRI**: la import alege „Atribuie la” un obiect existent (ex. `EQ_VISION`, `ROBOT_2_MOUNT`, `CDLR_S3`) și modelul
înlocuiește primitiva, păstrând poziția din config; sau lasă „plasare liberă” pentru echipamente suplimentare.

## Tutorial D – animație cadru cu cadru

Editorul din panoul de jos, tabul **Animație (cadre)**, funcționează atât în celula goală, cât și în celula MCRI.

1. Setează **fps** (implicit 25) și **lungimea** în cadre (implicit 250 = 10 s).
2. Selectează un obiect (model importat; sau Robot 1 / Robot 2 în celula MCRI). La cadrul **0** pune-l în poziția de start și apasă **◆ + Cheie**.
3. Mergi la alt cadru (câmpul „cadru”, click/drag în timeline, `,` / `.`), mută obiectul (gizmo sau câmpuri numerice; pentru roboți – sliderele axelor),
   apasă **◆ + Cheie**. Cu **auto-key** bifat, fiecare mutare cu gizmo-ul creează/actualizează singură cheia la cadrul curent.
4. **▶** (sau Space) redă animația; **buclă** pentru repetare; **lin** comută între interpolare liniară și smoothstep (accelerare/decelerare).
5. Editare: trage un romb ◆ pentru a muta cheia în timp; **◇ − Cheie** șterge cheia de la cadrul curent; **✕ Pistă** șterge toată animația obiectului;
   Ctrl+scroll = zoom pe timeline, scroll = derulare.
6. O cheie memorează poziție, rotație, scară și vizibilitate (obiecte) sau valorile axelor (roboți MCRI). Pentru un mecanism ierarhic animezi
   fiecare piesă pe propria pistă; copiii urmează automat părinții.
7. **⤓ / ⤒** exportă/importă animația ca JSON; 🗑 șterge tot. Animația este inclusă și în fișierul de proiect.

Sfat: pentru o secvență de proces (ex. pick & place) pune chei la fiecare „poziție importantă” (pre-pick, pick, lift, pre-place, place) la intervale
egale cu timpii reali ai mișcării (ex. 1,5 s = 37 cadre la 25 fps) și lasă interpolarea „lin” să genereze mișcarea.

## Tutorial E – import și conversie CAD (STEP, STL, …)

Formate acceptate direct: **STEP / STP / IGES / IGS / BREP** (OpenCascade WebAssembly, runtime ~7 MB descărcat o singură dată), **STL / OBJ / PLY /
3MF / DAE / FBX** (loadere Three.js), **GLB / GLTF** (nativ). Conversia în GLB se face în browser; progresul apare în panou.

- STEP păstrează culorile per față și structura de corpuri; unitățile sunt mm.
- STL/OBJ nu au unități: după import alege **mm / m / inch**.
- Modele cu Z în sus (majoritatea CAD-urilor): **Z↑**.
- Fișiere mari (> 50 MB, mii de corpuri) → zeci de secunde și scene grele: simplifică în CAD (fără șuruburi, filete, găuri mici) sau exportă sub-ansambluri.
- Modelele importate se păstrează în browser (IndexedDB); pentru o configurație permanentă în repo copiază GLB-urile (⤓) în `public/models/` și
  exportă **manifest.json** (vezi [Modele CAD permanente](#modele-cad-step--gltf)).

## Tutorial F – export pentru lucrare și salvarea proiectului

| Buton | Fișier | Conținut |
| --- | --- | --- |
| 📷 PNG | `mcri_viewport_<data>.png` | Captura viewport-ului (ascunde grila / folosește vederea dorită înainte). |
| ⤓ JSON | `mcri_secventa_<data>.json` | Secvența încărcată + toate operațiile din Gantt (resursă, nume, start, end) + metrici. |
| ⤓ CSV | `mcri_timpi_ciclu_<data>.csv` | Pe găleată: t_depal, t_etichetare, t_inspecție, t_repal, ciclu total, rebut; plus debit mediu/live, rebuturi, paleți (separator `;`, UTF-8, se deschide direct în Excel). |
| Program ⤓ | `program_ROBOT_x.json` | Programul manual al robotului. |
| Animație ⤓ | `animatie.json` | Pistele și cheile de animație. |
| manifest.json | `manifest.json` | Atribuirea modelelor CAD pentru `public/models/`. |
| 💾 Salvează proiect | `proiect_<data>.mcri.json` | Layout, modelele CAD (încorporate), animația, programele robot – **tot ce ai construit**, portabil pe alt calculator (📂 Deschide proiect). |

Pentru grafice în lucrare: rulează simularea 10–15 min la 8×, exportă CSV și calculează din coloane distribuția timpilor de ciclu și debitul;
JSON-ul operațiilor permite reconstruirea Gantt-ului (ex. în Excel/Python).

## Scurtături de tastatură

| Tastă | Acțiune |
| --- | --- |
| `Space` | Play/Pause (simulare; în editorul de animație – redare animație) |
| `→` | Step 0,1 s (simulare în pauză) |
| `,` / `.` sau `←` / `→` | Cadru anterior / următor (editorul de animație) |
| `G` / `E` | Gizmo mutare / rotire |
| `Shift+R` | Reset simulare |
| Ctrl + scroll | Zoom în Gantt / timeline |

---

## Instalare și rulare

```bash
npm install
npm run dev        # dezvoltare, http://localhost:5173
npm run build      # build static în dist/
npm run preview    # servește dist/
npm run check:ik   # verificare numerică FK/IK pentru punctele de lucru (headless)
npm run check:sim  # rulează 900 s de simulare headless și raportează debitul
```

Stack: Vite + React 19 + TypeScript, Three.js prin `@react-three/fiber` și `@react-three/drei`, Zustand, Tailwind.

## Structura proiectului

```
src/
  config/cell.config.ts   ← TOATE cotele (mm), layout, viteze, poziții, cinematică roboți, culori
  config/sequence.json    ← secvența implicită (durate pași roboți, timpi stații, rată rebut)
  kinematics/fk.ts        ← cinematică directă generală (lanț de articulații, matrice 4×4), conversie WPR
  kinematics/ik.ts        ← cinematică inversă numerică (Jacobian numeric + Damped Least Squares, limite de axe)
  sim/engine.ts           ← motor de simulare cu pași ficși (20 ms): produse, conveioare 1D, paleți, stații, roboți, log Gantt
  sim/conveyor.ts         ← geometrie 1D a traseelor (polilinii), proiecție
  sim/collision.ts        ← corpuri statice (AABB) + AABB gripper
  store/useSimStore.ts    ← stare UI (Zustand)
  scene/                  ← componente 3D parametrizate (gard, CDLR, conveioare, roboți, stații, siguranță, produse)
  components/             ← UI (TopBar, ObjectTree, Viewport, PropertiesPanel, SequenceEditor, StatusBar)
  utils/export.ts         ← export PNG / JSON / CSV, import secvență
public/models/            ← modele glTF opționale + manifest.json
scripts/                  ← verificări headless (tsx)
```

### Sistem de coordonate

Three.js cu **Y în sus**: X = est, Y = înălțime, Z = sud (în vederea de sus Z crește în jos). În panoul de proprietăți TCP-ul este afișat
în convenția robot (Z în sus, ca la FANUC): `X = x`, `Y = −z`, `Z = y`, iar W, P, R sunt unghiuri fixe XYZ. Toate cotele sunt în mm.

## Scena (primitive parametrizate)

Culori: RAL 5017 (structuri MCRI), RAL 1023 (gard/protecții), FANUC yellow (roboți), gri (conveioare).

1. **Gard** – stâlpi 2"×2" la pas 1219, panouri plasă h 2438, 2 tuneluri pentru găleți (est), goluri pentru paleți (nord/sud, cu bariere optice), ușă operator (vest).
2. **Linie paleți** – 10 zone CDLR (BF 1321, role Ø63,5 @ 114, TOR 508): S1 intrare (stivuitor) → S2 buffer → **S3 depaletizare** → S4–S6 transfer palet gol → **S7 repaletizare** → S8 ieșire → S9 masă rotativă infoliator → S10 ieșire. Palet GMA 1219×1016, găleți Ø305×370 pe 3 niveluri (3 rânduri × 4), foi intermediare 1219×1016×4.
3. **Robot 1 – FANUC M-410iC/315** (4 axe, 315 kg, rază 3143) pe riser H 812,8, gripper de strat (placă cu ventuze) care ridică un rând de 4 găleți și scoate foile intermediare în container.
4. **Linie găleți** în buclă (BF 457, TOR 762): B1 ieșire prin tunel → etichetator (2 s) → hotă vision 800 lung cu 1 cameră sus + 2 laterale (1,5 s, 1 din 25 respinsă) → pusher rebut + tobogan → B2 curbă 180° → B3 retur prin al doilea tunel → opritor de capăt pentru Robot 2. Opritoare PCS19 și fotocelule la fiecare stație.
5. **Robot 2 – FANUC M-20iB/25** (6 axe, rază 1853) pe piedestal 500×500 H 900, gripper cu 4 ventuze; cinematică din ROS-Industrial `fanuc_m20ib_support` (J1 650, offset J2 +75, braț 905, J3→J4 120, antebraț 865, J5→flanșă 100). Magazie de foi intermediare (platformă 750, montanți 1000).
6. **Infoliator Wulftec** – masă rotativă Ø1650 + catarg cu cărucior de film, ciclu 60 s; ieșire prin barieră optică.
7. **Siguranță** – E-stop pe riser/piedestal/ușă, bariere optice intrare/ieșire paleți, marcaje pe pardoseală.

## Cinematică

- **FK generală**: lanțul este o listă de elemente `{ translate, axis, coeffs, offsetDeg }`; unghiul fiecărui element = `offset + Σ coeffs[i]·q[i]`.
  Astfel se modelează direct cuplajul paralelogramului M-410 (J3 absolut, încheietură menținută orizontală) fără cod special.
- **IK numerică**: Jacobian prin diferențe finite + Damped Least Squares cu amortizare adaptivă, limite de axe, eroare de orientare prin axă·unghi.
  `solveIKRobust` încearcă mai multe seed-uri (continuitate, seed analitic cu J1 orientat spre țintă, seed din config) și alege postura cea mai naturală.
- Durata unei mișcări = max(durata din `sequence.json`, durata impusă de vitezele de catalog ale axelor).

### TODO de verificat cu cataloagele

În `cell.config.ts` sunt marcate cu `TODO`:
- M-410iC/315: `R1_H1` (bază → axa J2), `R1_A1`, `R1_L2` (braț inferior), `R1_L3` (braț superior), `R1_D4`, limitele J2/J3 (plaje de catalog 144° / 136°) și vitezele – de verificat în RM-410iC(E)-06b.
- M-20iB/25: cuplajul J2/J3 afișat de controlerul FANUC nu este modelat (URDF-ul ROS folosește axe independente).

## Simulare

- Pași ficși de 20 ms, independenți de FPS (acumulator în `useFrame`); butonul Step avansează 0,1 s.
- Produsele (găleți, foi, paleți) sunt entități: pe conveioare se mișcă cu viteza conveiorului pe abscisa `s`, se opresc la opritoare / în acumulare, sunt atașate gripperului în timpul transportului robotic, urmează paletul când acesta se mișcă sau se rotește pe infoliator.
- Secvența este **determinată**: saltul la o operație din Gantt = reset + re-simulare până la momentul ales (verificat în `scripts/check-sim.ts`).
- Debitul live este calculat pe fereastra ultimelor 60 s; media pe întreaga durată apare în exportul CSV.
- Coliziuni: AABB gripper (din cadrul flanșei) vs. corpuri statice (gard, ghidaje laterale, cadre CDLR, stații, montanți, container, catarg). Evidențiere roșie a gripperului și a corpului lovit + mesaj în bara de stare. În secvența automată nu apar coliziuni; testează cu jog manual (ex. Robot 1 → X 2600, Y −1500, Z 800, R 90).

## Secvența (`src/config/sequence.json`)

Fiecare robot are un ciclu de rând/găleată și un ciclu de foaie: liste de pași `{ id, name, target, duration, color, action }` cu
`target ∈ prePick | pick | prePlace | place | dwell | home` și `action ∈ grip | release`. Timpii stațiilor (etichetare 2 s, inspecție 1,5 s
cu `rejectEvery: 25`, înfoliere 60 s) și întârzierea stivuitorului sunt în `stations`. Fișierul poate fi editat direct sau încărcat la
rulare cu butonul **Import** (acceptă și fișierele exportate cu **JSON**). Schema: `src/config/sequence.schema.json`.

## Export

- **PNG** – captură a viewport-ului (rezoluția canvas-ului).
- **JSON** – secvența încărcată + toate operațiile înregistrate (resursă, nume, start, end) + metrici.
- **CSV** – timpii de ciclu pe găleată: `t_depal`, `t_etichetare`, `t_inspectie`, `t_repal`, ciclu total, rebut; plus metrici agregate (separator `;`, UTF-8 BOM pentru Excel).

## Modele CAD (STEP → glTF)

Aplicația înlocuiește automat primitiva unui obiect cu un model glTF dacă acesta este înregistrat în `public/models/manifest.json`:

```json
{
  "EQ_VISION": { "file": "Statie_inspectie_vision_457.glb", "scale": 1, "position": [0, 0, 0], "rotation": [0, 0, 0] },
  "ROBOT_1_MOUNT": { "file": "Riser_M410.glb", "scale": 1000 }
}
```

- cheia = **id-ul obiectului** din Object Tree; `scale: 1` pentru modele în mm, `1000` pentru modele în metri; `position` în mm, `rotation` în grade.
- Modelul este plasat în același cadru ca primitiva: pentru echipamente originea este colțul/centrul definit în `cell.config.ts` (ex. stația vision: centrul la `STATIONS.vision.pos`, Y = 0 la pardoseală); pentru link-urile roboților se folosește cadrul fiecărei articulații (momentan se înlocuiește robotul întreg – pentru link-uri separate adaugă chei `ROBOT_1_J1` … în `Robot.tsx`).

Id-uri utile: `ROBOT_1`, `ROBOT_2`, `TOOL_1`, `TOOL_2`, `ROBOT_1_MOUNT`, `ROBOT_2_MOUNT`, `CDLR_S1`…`CDLR_S10`, `CONV_B1`, `CONV_B2`, `CONV_B3`,
`EQ_LABELER`, `EQ_VISION`, `EQ_PUSHER`, `EQ_CHUTE`, `EQ_WRAPPER`, `EQ_SHEET_MAG`, `EQ_SHEET_BIN`.

### Conversie direct în aplicație (STEP, STL, OBJ, PLY, 3MF, DAE, FBX, IGES, BREP)

Nu mai e nevoie de conversie manuală: selectezi sau tragi direct fișierul `.stp` / `.stl` / etc. în tabul **Modele CAD** sau peste viewport.

- **STEP / IGES / BREP** sunt triangulate în browser cu OpenCascade compilat în WebAssembly ([occt-import-js](https://github.com/kovacsv/occt-import-js));
  runtime-ul (~7 MB) se descarcă o singură dată, la prima conversie. Culorile per față din STEP sunt păstrate; ieșirea este în mm.
- **STL / OBJ / PLY / 3MF / DAE / FBX** sunt citite cu loaderele Three.js. STL și OBJ nu poartă unități: verifică scara (mm / m / inch) după import.
- Rezultatul este un GLB salvat în browser; butonul ⤓ de lângă model îl descarcă pentru `public/models/`.
- Fișierele WASM sunt copiate automat în `public/occt/` la `npm install` / `npm run build` (script `scripts/copy-occt.mjs`).
- Ansamblurile STEP mari (> 50 MB, mii de corpuri) pot dura zeci de secunde și produc modele grele; simplifică-le în CAD (fără șuruburi, filete).

### Conversie externă (alternativă)

1. **FreeCAD (0.21+)** – `File → Import` STEP, selectează corpurile, `File → Export → glTF (*.glb)`. Verifică unitățile (FreeCAD exportă în mm).
2. **CadQuery / OCP** (Python):
   ```python
   import cadquery as cq
   shape = cq.importers.importStep("Statie_inspectie_vision_457.step")
   cq.exporters.export(shape, "Statie_inspectie_vision_457.glb")   # CadQuery ≥ 2.4 (exportGLTF)
   ```
   Pentru versiuni mai vechi: export STL/OBJ din CadQuery, apoi glTF din Blender (`File → Export → glTF 2.0`).
3. **CAD Exchanger** (cadexchanger.com) – conversie directă STEP → glTF, cu control al toleranței de teselare.
4. Optimizare (opțional): `npx @gltf-transform/cli optimize in.glb out.glb --compress draco` (în acest caz adaugă `DRACOLoader` în `ModelOrPrimitive.tsx`).

Recomandări: simplifică modelele (fără filete/găuri fine), < 5–10 MB per fișier, axa Y în sus (sau setează `rotation: [-90, 0, 0]` pentru modele cu Z în sus).

## Publicare pe GitHub Pages

1. Creează repo-ul pe GitHub (ex. `mcri-cell-simulator`) și fă push pe `main`.
2. În repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow-ul `.github/workflows/deploy.yml` construiește cu `BASE_PATH=/<nume-repo>/` și publică `dist/`.
4. Aplicația va fi disponibilă la https://johnnyarg14.github.io/mcri-cell-simulator/.

## Limitări cunoscute (mockup)

- Geometria roboților este aproximativă (primitive); lungimile M-410 sunt estimate – vezi TODO.
- Coliziunile se verifică doar între gripper și corpurile statice (nu între link-uri sau produse).
- Interpolarea mișcărilor este în spațiul articulațiilor (profil smoothstep), nu traiectorii liniare în spațiul cartezian.
- Fără fizică: produsele sunt entități cinematice.
