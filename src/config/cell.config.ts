/**
 * MCRI Cell Simulator – configurația celulei.
 *
 * TOATE cotele sunt în milimetri. Sistem de coordonate (Three.js, Y în sus):
 *   X  = est (spre dreapta în vederea de sus)
 *   Y  = înălțime (0 = pardoseală)
 *   Z  = sud (în jos în vederea de sus)
 * Poziții „plan” = { x, z }.  Unghiuri în grade.
 *
 * Nimic din scenă/componente nu are cote hardcodate: totul vine de aici.
 * Valorile marcate TODO trebuie verificate cu cataloagele FANUC / desenele MCRI.
 */

export type Vec2 = { x: number; z: number };
export type Vec3 = { x: number; y: number; z: number };

// ---------------------------------------------------------------------------
// Culori (RAL / FANUC)
// ---------------------------------------------------------------------------
export const COLORS = {
  ral5017: '#0a4a8c', // MCRI albastru – structuri (RAL 5017 Traffic blue)
  ral1023: '#f7b500', // galben – gard, protecții (RAL 1023 Traffic yellow)
  fanucYellow: '#ffcc1a', // FANUC yellow – roboți
  fanucBlack: '#2a2a2e',
  conveyorGrey: '#8d9299', // conveioare
  conveyorDark: '#5c6168',
  rollerGrey: '#b4b8bd',
  steel: '#9aa0a6',
  floor: '#2f3238',
  floorLine: '#f2c20f',
  pallet: '#b08656',
  slipSheet: '#d9cfb8',
  bucket: '#e8e8ec',
  bucketLid: '#1f6fd0',
  label: '#ffffff',
  reject: '#e5484d',
  selection: '#ff9f1a',
  collision: '#ff2b2b',
  lightCurtain: '#ff3b3b',
  glass: '#7fb2ff',
} as const;

// ---------------------------------------------------------------------------
// Simulare
// ---------------------------------------------------------------------------
export const SIM = {
  dt: 0.02, // pas fix de simulare [s]
  stepTicks: 5, // butonul „Step” avansează 5 pași (0,1 s)
  targetRateBpm: 10, // ținta: găleți/min
  rateWindowS: 60, // fereastra pentru debitul „live”
  maxOpsLog: 4000, // operații păstrate în Gantt
  randomSeed: 20240517,
  speedRange: { min: 0.25, max: 8 },
};

// ---------------------------------------------------------------------------
// Produse
// ---------------------------------------------------------------------------
export const PALLET = { l: 1219, w: 1016, h: 140, deckT: 22, blockW: 90 }; // GMA 48"×40"
export const SLIP_SHEET = { l: 1219, w: 1016, t: 4 };
export const BUCKET = { dia: 305, h: 370, lidH: 18, lidDia: 312, bottomDia: 270, gapOnConveyor: 25 };

/**
 * Pattern de paletizare pe nivel. Paletul circulă cu latura 1219 pe direcția Z
 * (de-a lungul liniei de paleți) și 1016 pe X. Fiecare nivel = listă de rânduri,
 * fiecare rând = listă de poziții {x,z} relative la centrul paletului.
 * Robotul 1 ridică un rând întreg (4 găleți) deodată.
 */
const ROW_Z = [-457.5, -152.5, 152.5, 457.5];
const ROW_X = [-305, 0, 305];
const layer = () => ROW_X.map((x) => ROW_Z.map((z) => ({ x, z })));
export const PATTERN: { layers: Vec2[][][] } = {
  layers: [layer(), layer(), layer()], // 3 niveluri × 3 rânduri × 4 găleți = 36 găleți
};
export const SHEETS_BETWEEN_LAYERS = true; // foaie intermediară între niveluri

// ---------------------------------------------------------------------------
// Gard de protecție
// ---------------------------------------------------------------------------
export type FenceOpening = {
  id: string;
  name: string;
  side: 'north' | 'south' | 'east' | 'west';
  center: number; // coordonata de-a lungul laturii (x pt. N/S, z pt. E/V)
  width: number;
  height: number; // înălțimea golului (tunel) – panoul rămâne deasupra
  kind: 'tunnel' | 'gate' | 'door';
};
export const FENCE = {
  x0: -3300,
  x1: 4600,
  z0: -4200,
  z1: 6800,
  postSize: 50.8, // 2"×2"
  postPitch: 1219,
  panelHeight: 2438,
  panelBottomGap: 150,
  meshStep: 100, // pas vizual plasă
  openings: <FenceOpening[]>[
    { id: 'tunnel_out', name: 'Tunel ieșire găleți', side: 'east', center: 1500, width: 700, height: 700, kind: 'tunnel' },
    { id: 'tunnel_in', name: 'Tunel retur găleți', side: 'east', center: 3100, width: 700, height: 700, kind: 'tunnel' },
    { id: 'gate_pallet_in', name: 'Gol intrare paleți (barieră optică)', side: 'north', center: -1700, width: 1700, height: 2438, kind: 'gate' },
    { id: 'gate_pallet_out', name: 'Gol ieșire paleți (barieră optică)', side: 'south', center: -1700, width: 1700, height: 2438, kind: 'gate' },
    { id: 'door_west', name: 'Ușă acces operator', side: 'west', center: 1000, width: 1000, height: 2100, kind: 'door' },
  ],
};

// ---------------------------------------------------------------------------
// Linia de paleți (CDLR – chain driven live roller)
// ---------------------------------------------------------------------------
export type PalletZoneRole = 'infeed' | 'buffer' | 'depal' | 'transfer' | 'repal' | 'exit' | 'wrapper' | 'outfeed';
export type PalletZone = { id: string; name: string; z0: number; z1: number; role: PalletZoneRole };

const ZONE_L = 1525;
const zone = (id: string, name: string, center: number, role: PalletZoneRole): PalletZone => ({
  id,
  name,
  z0: center - ZONE_L / 2,
  z1: center + ZONE_L / 2,
  role,
});

export const PALLET_LINE = {
  x: -1700, // axa liniei
  bf: 1321, // between frames
  tor: 508, // top of roller
  rollerDia: 63.5,
  rollerPitch: 114,
  frameH: 160,
  speed: 150, // mm/s (≈ 9 m/min)
  zoneLength: ZONE_L,
  zones: <PalletZone[]>[
    zone('CDLR_S1', 'CDLR S1 – Intrare paleți (încărcare stivuitor)', -4750, 'infeed'),
    zone('CDLR_S2', 'CDLR S2 – Buffer', -3225, 'buffer'),
    zone('CDLR_S3', 'CDLR S3 – Stație depaletizare', -1700, 'depal'),
    zone('CDLR_S4', 'CDLR S4 – Transfer palet gol', -175, 'transfer'),
    zone('CDLR_S5', 'CDLR S5 – Transfer', 1350, 'transfer'),
    zone('CDLR_S6', 'CDLR S6 – Buffer palet gol', 2875, 'transfer'),
    zone('CDLR_S7', 'CDLR S7 – Stație repaletizare', 4400, 'repal'),
    zone('CDLR_S8', 'CDLR S8 – Ieșire palet plin', 5925, 'exit'),
    zone('CDLR_S9', 'Masă rotativă infoliator', 7450, 'wrapper'),
    zone('CDLR_S10', 'CDLR S10 – Ieșire palet înfoliat', 8975, 'outfeed'),
  ],
  infeedDelayS: 30, // timp până apare un palet plin nou la S1 (stivuitor)
  outfeedDwellS: 6, // timp după care paletul înfoliat dispare din S10
};

// ---------------------------------------------------------------------------
// Linia de găleți (conveior îngust în buclă)
// ---------------------------------------------------------------------------
export type ConveyorStop = { id: string; name: string; s: number; kind: 'stop' | 'reject' | 'end' };
export type Photocell = { id: string; name: string; s: number };
export type BucketConveyor = {
  id: string;
  name: string;
  path: Vec2[]; // polilinie în plan (mm)
  next?: string; // conveior următor (transfer la capăt)
  stops: ConveyorStop[];
  photocells: Photocell[];
};

/** generează puncte pe un arc de cerc (în plan) */
export function arcPoints(cx: number, cz: number, r: number, a0deg: number, a1deg: number, n = 12): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0deg + ((a1deg - a0deg) * i) / n) * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(a), z: cz + r * Math.sin(a) });
  }
  return pts;
}

export const BUCKET_LINE = {
  bf: 457,
  tor: 762,
  frameH: 120,
  guideRailH: 150, // ghidaje laterale peste TOR
  guideRailOffset: 457 / 2 + 15,
  speed: 250, // mm/s
  legPitch: 1500,
  conveyors: <BucketConveyor[]>[
    {
      id: 'CONV_B1',
      name: 'Conveior B1 – ieșire găleți (depal → etichetare → vision)',
      path: [
        { x: -600, z: 1500 },
        { x: 7800, z: 1500 },
      ],
      next: 'CONV_B2',
      stops: [
        { id: 'ST_LAB', name: 'Opritor PCS19 etichetator', s: 6100, kind: 'stop' },
        { id: 'ST_VIS', name: 'Opritor PCS19 inspecție', s: 7300, kind: 'stop' },
        { id: 'ST_REJ', name: 'Opritor PCS19 pusher rebut', s: 8000, kind: 'reject' },
      ],
      photocells: [
        { id: 'PE_B1_IN', name: 'Fotocelulă zonă depunere robot', s: 1500 },
        { id: 'PE_B1_TUN', name: 'Fotocelulă tunel ieșire', s: 5200 },
        { id: 'PE_LAB', name: 'Fotocelulă etichetator', s: 6060 },
        { id: 'PE_VIS', name: 'Fotocelulă inspecție', s: 7260 },
        { id: 'PE_REJ', name: 'Fotocelulă pusher', s: 7960 },
      ],
    },
    {
      id: 'CONV_B2',
      name: 'Conveior B2 – curbă 180°',
      path: arcPoints(7800, 2300, 800, -90, 90, 16),
      next: 'CONV_B3',
      stops: [],
      photocells: [],
    },
    {
      id: 'CONV_B3',
      name: 'Conveior B3 – retur găleți (vision → repaletizare)',
      path: [
        { x: 7800, z: 3100 },
        { x: -100, z: 3100 },
      ],
      stops: [{ id: 'ST_REPAL', name: 'Opritor capăt – preluare Robot 2', s: 7900 - BUCKET.dia / 2 - 10, kind: 'end' }],
      photocells: [
        { id: 'PE_B3_TUN', name: 'Fotocelulă tunel retur', s: 3200 },
        { id: 'PE_REPAL', name: 'Fotocelulă preluare Robot 2', s: 7900 - BUCKET.dia / 2 - 40 },
      ],
    },
  ],
  /** poziția lotului de 4 găleți depuse de Robot 1 pe B1 (coordonate s) */
  dropSlots: [150, 150 + 330, 150 + 660, 150 + 990],
};

// ---------------------------------------------------------------------------
// Stații
// ---------------------------------------------------------------------------
export const STATIONS = {
  labeler: {
    id: 'EQ_LABELER',
    name: 'Etichetator inline (1 stație)',
    pos: { x: 5500, z: 1500 } as Vec2,
    box: { w: 600, d: 420, h: 700 }, // cutie aplicator, lateral față de conveior (partea -Z)
    offsetZ: -560,
    standH: 1100,
    applicatorReach: 120,
    dwellS: 2.0,
  },
  vision: {
    id: 'EQ_VISION',
    name: 'Stație inspecție vizuală (hotă cu boltă)',
    pos: { x: 6700, z: 1500 } as Vec2,
    length: 800,
    width: 900,
    archH: 1700, // înălțimea bolții de la pardoseală
    cameraSize: 70,
    dwellS: 1.5,
    rejectEvery: 25, // 1 din 25 respinsă
  },
  pusher: {
    id: 'EQ_PUSHER',
    name: 'Pusher rebut (cilindru pneumatic)',
    pos: { x: 7400, z: 1500 } as Vec2,
    stroke: 480,
    extendS: 0.5,
    retractS: 0.5,
    sideZ: +1, // pusherul stă pe partea +Z, împinge spre -Z
  },
  chute: {
    id: 'EQ_CHUTE',
    name: 'Tobogan rebut',
    start: { x: 7400, z: 1500 - 460 } as Vec2,
    end: { x: 7400, z: 300 } as Vec2,
    width: 420,
    topY: 762,
    bottomY: 350,
    binSize: { w: 700, d: 700, h: 500 },
    slideS: 1.6,
  },
  wrapper: {
    id: 'EQ_WRAPPER',
    name: 'Infoliator Wulftec (masă rotativă + catarg)',
    center: { x: -1700, z: 7450 } as Vec2,
    turntableDia: 1650,
    turntableH: 90,
    mastPos: { x: -1700 + 1400, z: 7450 } as Vec2,
    mast: { w: 300, d: 300, h: 2600 },
    carriage: { w: 350, d: 250, h: 600 },
    dwellS: 60,
    rpm: 12,
  },
  sheetMagazine: {
    id: 'EQ_SHEET_MAG',
    name: 'Magazie foi intermediare',
    center: { x: 900, z: 4400 } as Vec2,
    platformH: 750,
    guidePostH: 1000,
    guidePostSize: 40,
    sheetCount: 40,
    footprint: { x: SLIP_SHEET.w, z: SLIP_SHEET.l },
  },
  sheetWasteBin: {
    id: 'EQ_SHEET_BIN',
    name: 'Container foi uzate',
    center: { x: 1600, z: -1300 } as Vec2,
    size: { w: 1200, d: 1400, h: 700 },
  },
};

// ---------------------------------------------------------------------------
// Roboți
// ---------------------------------------------------------------------------
/**
 * Un element de lanț cinematic: translatare în cadrul părintelui, apoi rotație
 * în jurul `axis` cu unghiul = offsetDeg + Σ coeffs[i]·q[i] (q = axele active, în grade).
 * Astfel se modelează și cuplajul paralelogramului M-410 (sculă menținută orizontală).
 */
export type ChainLink = {
  id: string;
  translate: [number, number, number];
  axis: [number, number, number];
  coeffs: number[]; // lungime = numărul de axe active
  offsetDeg?: number;
};
export type JointSpec = { name: string; min: number; max: number; speed: number }; // grade, grade/s
export type TeachPoint = { name: string; pos: Vec3; xAxis: [number, number, number] }; // TCP în coordonate celulă; scula privește în jos

export type RobotConfig = {
  id: string;
  name: string;
  model: string;
  axes: number;
  reach: number;
  payloadKg: number;
  base: Vec3; // poziția flanșei de bază (deasupra riser-ului / piedestalului)
  mount: { kind: 'riser' | 'pedestal'; w: number; d: number; h: number; name: string };
  joints: JointSpec[];
  chain: ChainLink[];
  tool: { id: string; name: string; tcpOffset: number; kind: 'layer' | 'cups4'; plateL: number; plateW: number; plateT: number; cupLen: number };
  home: number[];
  ikSeed: number[];
  teachPoints: TeachPoint[];
  color: string;
};

// --- Robot 1: FANUC M-410iC/315 (4 axe, paletizare) -------------------------
// TODO verificare dimensiuni din RM-410iC(E)-06b (desen de gabarit):
const R1_H1 = 1020; // bază → axa J2 (TODO)
const R1_A1 = 330; // offset orizontal axa J1 → axa J2 (TODO)
const R1_L2 = 1250; // braț inferior J2 → J3 (TODO)
const R1_L3 = 1600; // braț superior J3 → încheietură (TODO)
const R1_D4 = 250; // coborâre încheietură → flanșă J4 (TODO)
const R1_RISER_H = 812.8;

export const ROBOT_1: RobotConfig = {
  id: 'ROBOT_1',
  name: 'Robot 1 – FANUC M-410iC/315 (depaletizare)',
  model: 'FANUC M-410iC/315',
  axes: 4,
  reach: 3143,
  payloadKg: 315,
  base: { x: 0, y: R1_RISER_H, z: 0 },
  mount: { kind: 'riser', w: 1100, d: 1100, h: R1_RISER_H, name: 'Riser sudat H 812,8' },
  joints: [
    { name: 'J1', min: -180, max: 180, speed: 120 },
    { name: 'J2', min: -25, max: 119, speed: 120 }, // TODO limite catalog (plajă 144°)
    { name: 'J3', min: -75, max: 75, speed: 130 }, // TODO limite catalog (plajă 136°; aici lărgită pt. depunere la TOR 762)
    { name: 'J4', min: -270, max: 270, speed: 300 },
  ],
  chain: [
    { id: 'J1', translate: [0, 0, 0], axis: [0, 1, 0], coeffs: [1, 0, 0, 0] },
    { id: 'J2', translate: [R1_A1, R1_H1, 0], axis: [0, 0, -1], coeffs: [0, 1, 0, 0] },
    { id: 'J3', translate: [0, R1_L2, 0], axis: [0, 0, 1], coeffs: [0, 1, 1, 0] }, // unghi absolut (paralelogram)
    { id: 'WRIST_LEVEL', translate: [R1_L3, 0, 0], axis: [0, 0, 1], coeffs: [0, 0, -1, 0] }, // menține scula orizontală
    { id: 'J4', translate: [0, -R1_D4, 0], axis: [0, -1, 0], coeffs: [0, 0, 0, 1] },
    { id: 'FLANGE', translate: [0, 0, 0], axis: [1, 0, 0], coeffs: [0, 0, 0, 0], offsetDeg: 90 }, // Z sculă în jos
  ],
  tool: { id: 'TOOL_1', name: 'Gripper de strat (placă cu ventuze, 1 rând × 4 găleți)', tcpOffset: 130, kind: 'layer', plateL: 1320, plateW: 360, plateT: 60, cupLen: 70 },
  home: [0, 20, 20, 0],
  ikSeed: [0, 40, 10, 0],
  teachPoints: [
    { name: 'HOME', pos: { x: 2200, y: 1900, z: 0 }, xAxis: [1, 0, 0] },
    { name: 'Pre-pick rând (nivel 3)', pos: { x: -1700, y: 2100, z: -1700 }, xAxis: [0, 0, 1] },
    { name: 'Pre-place conveior B1', pos: { x: 0, y: 1500, z: 1500 }, xAxis: [1, 0, 0] },
    { name: 'Container foi', pos: { x: 1600, y: 1300, z: -1300 }, xAxis: [0, 0, 1] },
  ],
  color: COLORS.fanucYellow,
};

// --- Robot 2: FANUC M-20iB/25 (6 axe) ---------------------------------------
// Cinematică din ROS-Industrial fanuc_m20ib_support (m20ib25):
const R2_D1 = 650; // bază → J2 (vertical)
const R2_A1 = 75; // offset J2
const R2_A2 = 905; // braț J2 → J3
const R2_A3 = 120; // J3 → axa J4
const R2_D4 = 865; // antebraț J4 → J5
const R2_D6 = 100; // J5 → flanșă
const R2_PED_H = 900;

export const ROBOT_2: RobotConfig = {
  id: 'ROBOT_2',
  name: 'Robot 2 – FANUC M-20iB/25 (repaletizare)',
  model: 'FANUC M-20iB/25',
  axes: 6,
  reach: 1853,
  payloadKg: 25,
  base: { x: -400, y: R2_PED_H, z: 4400 },
  mount: { kind: 'pedestal', w: 500, d: 500, h: R2_PED_H, name: 'Piedestal 500×500 H 900' },
  joints: [
    { name: 'J1', min: -185, max: 185, speed: 195 },
    { name: 'J2', min: -100, max: 160, speed: 175 },
    { name: 'J3', min: -185, max: 273, speed: 180 },
    { name: 'J4', min: -200, max: 200, speed: 360 },
    { name: 'J5', min: -140, max: 140, speed: 360 },
    { name: 'J6', min: -450, max: 450, speed: 550 },
  ],
  chain: [
    { id: 'J1', translate: [0, R2_D1, 0], axis: [0, 1, 0], coeffs: [1, 0, 0, 0, 0, 0] },
    { id: 'J2', translate: [R2_A1, 0, 0], axis: [0, 0, -1], coeffs: [0, 1, 0, 0, 0, 0] },
    { id: 'J3', translate: [0, R2_A2, 0], axis: [0, 0, 1], coeffs: [0, 0, 1, 0, 0, 0] },
    { id: 'J4', translate: [0, R2_A3, 0], axis: [1, 0, 0], coeffs: [0, 0, 0, 1, 0, 0] },
    { id: 'J5', translate: [R2_D4, 0, 0], axis: [0, 0, -1], coeffs: [0, 0, 0, 0, 1, 0] },
    { id: 'J6', translate: [R2_D6, 0, 0], axis: [1, 0, 0], coeffs: [0, 0, 0, 0, 0, 1] },
    { id: 'FLANGE', translate: [0, 0, 0], axis: [0, 1, 0], coeffs: [0, 0, 0, 0, 0, 0], offsetDeg: 90 }, // Z sculă = X flanșă
  ],
  tool: { id: 'TOOL_2', name: 'Gripper cu 4 ventuze (găleată / foaie)', tcpOffset: 190, kind: 'cups4', plateL: 260, plateW: 260, plateT: 25, cupLen: 60 },
  home: [0, 0, 0, 0, 90, 0],
  ikSeed: [0, 45, -20, 0, 20, 0],
  teachPoints: [
    { name: 'HOME', pos: { x: 500, y: 1900, z: 4400 }, xAxis: [1, 0, 0] },
    { name: 'Pick conveior retur', pos: { x: -100 + 0, y: 1132, z: 3100 }, xAxis: [1, 0, 0] },
    { name: 'Magazie foi', pos: { x: 900, y: 950, z: 4400 }, xAxis: [1, 0, 0] },
    { name: 'Centru palet repal', pos: { x: -1700, y: 1800, z: 4400 }, xAxis: [1, 0, 0] },
  ],
  color: COLORS.fanucYellow,
};

export const ROBOTS: RobotConfig[] = [ROBOT_1, ROBOT_2];

/** parametri mișcare robot (cote pentru traiectorii pick/place) */
export const MOTION = {
  approachHeight: 250, // ridicare deasupra punctului de prindere/depunere
  r1DropYaw: 90, // placa gripper paralelă cu B1 la depunere
  r1BucketPitchOnPlate: 330, // pas găleți pe placă (= pas pe conveior)
};

// ---------------------------------------------------------------------------
// Siguranță
// ---------------------------------------------------------------------------
export const SAFETY = {
  estops: [
    { id: 'ESTOP_R1', name: 'E-stop riser Robot 1', pos: { x: 560, y: 650, z: 0 } as Vec3, rotY: 0 },
    { id: 'ESTOP_R2', name: 'E-stop piedestal Robot 2', pos: { x: -140, y: 700, z: 4400 } as Vec3, rotY: 0 },
    { id: 'ESTOP_DOOR', name: 'E-stop ușă operator', pos: { x: -3300 + 40, y: 1200, z: 1700 } as Vec3, rotY: 90 },
  ],
  lightCurtains: [
    { id: 'LC_IN', name: 'Barieră optică intrare paleți', center: { x: -1700, z: -4200 } as Vec2, span: 1700, height: 1400, axis: 'x' as const },
    { id: 'LC_OUT', name: 'Barieră optică ieșire paleți', center: { x: -1700, z: 6800 } as Vec2, span: 1700, height: 1400, axis: 'x' as const },
  ],
  floorMarkings: [
    { id: 'MARK_R1', name: 'Marcaj pardoseală – zonă Robot 1', rect: { x0: -1000, z0: -1000, x1: 2400, z1: 1000 }, lineW: 100 },
    { id: 'MARK_R2', name: 'Marcaj pardoseală – zonă Robot 2', rect: { x0: -1000, z0: 3400, x1: 1600, z1: 5600 }, lineW: 100 },
    { id: 'MARK_DOOR', name: 'Marcaj pardoseală – ușă', rect: { x0: -3300, z0: 400, x1: -2500, z1: 1600 }, lineW: 80 },
  ],
};

// ---------------------------------------------------------------------------
// Pardoseală / scenă
// ---------------------------------------------------------------------------
export const FLOOR = { x0: -6000, x1: 10000, z0: -8000, z1: 11000, gridMm: 1000 };

export const CAMERA_PRESETS = {
  iso: { position: [9500, 7500, 12500], target: [1800, 300, 1800] },
  top: { position: [1500, 22000, 2001], target: [1500, 0, 2000] },
  front: { position: [1500, 2500, 20000], target: [1500, 1000, 2000] },
  side: { position: [21000, 2500, 2000], target: [1500, 1000, 2000] },
} as const;
export type CameraPresetId = keyof typeof CAMERA_PRESETS;

/** fișier manifest pentru modelele glTF (public/models/manifest.json) */
export const MODELS_MANIFEST_URL = 'models/manifest.json';
