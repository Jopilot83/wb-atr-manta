// tools/render_test_page.ts
import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import { computeWB } from "../src/engine.ts";
import { validateInput } from "../src/validation/validateInput.ts";

import { scenarioManta1001 } from "../src/scenarios/manta_10_01.standard.ts";
import { scenarioManta1002 } from "../src/scenarios/manta_10_02.standard.ts";
import { scenarioManta1003 } from "../src/scenarios/manta_10_03.standard.ts";

// ==================================================
// CONFIG
// ==================================================
const OUTPUT_PATH = "./render/wb_filled_test.png";

const FONT = "42px Helvetica";
const TEXT_COLOR = "#000";

// ==================================================
// HELPERS
// ==================================================
const W = (v: number) => Math.ceil(v).toString();             // pesi interi (CLI = per eccesso)
const I = (v: number) => v.toFixed(2).replace(".", ",");      // index 2 decimali
const I3 = (v: number) => v.toFixed(3).replace(".", ",");     // index 3 decimali (CABIN)

function indexToPercentMAC(index: number, weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 0;
  return (index * 1000) / (weightKg * 0.2285) + 25;
}

function loadJsonIfExists(path: string): any {
  if (!fs.existsSync(path)) return {};
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function stationIdToNumber(stationId: string): number | null {
  // "CARGO_7_5" -> 7.5 ; "CARGO_14" -> 14
  if (!stationId.startsWith("CARGO_")) return null;
  const raw = stationId.replace("CARGO_", ""); // "7_5" or "14"
  const n = Number(raw.replace("_", "."));
  return Number.isFinite(n) ? n : null;
}

function loadJsonIfExists2(p: string): any {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function getCargoStationsFromRuntime(): Record<string, number> {
  const p = "state/pdf_input.runtime.json";
  if (!fs.existsSync(p)) return {};

  const data = JSON.parse(fs.readFileSync(p, "utf-8"));

  // ✅ il tuo file ha le stazioni dentro uiDelta
  const stations =
    data?.uiDelta?.cargoStationsKg ??
    data?.cargoStationsKg ?? // fallback se un giorno cambi formato
    {};

  // normalizza numeri
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stations)) out[k] = Number(v || 0);
  return out;
}

function drawCargoStationsOverlay(
  ctx: CanvasRenderingContext2D,
  cargoStationsKg: Record<string, number>
) {
  // =====================
  // COSTANTI
  // =====================
  const Y_RULER = 3980;
  const Y_DOT_RIGHT = 3030;
  const Y_DOT_LEFT = 3350;

  const X_STATION_7_5 = 2156;
  const X_STATION_8 = 2255;

  const CALL_OUT_BASE_Y = 2482;
  const CALL_OUT_DELTA_Y = 130; // spacing reale, verso l’ALTO

  const DX_PER_HALF = X_STATION_8 - X_STATION_7_5;

  const RED = "#cc0000";
  const BLACK = "#ffffffff";
  const LINE_W = 10;
  const DOT_R = 18;

  // =====================
  // STAZIONI ATTIVE
  // =====================
  const active = Object.entries(cargoStationsKg ?? {})
    .map(([id, kg]) => {
      const n = stationIdToNumber(id);
      const w = Number(kg || 0);
      if (n == null || w <= 0) return null;
      return { n, kg: w };
    })
    .filter(Boolean) as { n: number; kg: number }[];

  if (active.length === 0) return;

  active.sort((a, b) => a.n - b.n);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // =====================
  // DRAW
  // =====================
  active.forEach((s, i) => {
    const steps = Math.round((s.n - 7.5) / 0.5);
    const x = X_STATION_7_5 + steps * DX_PER_HALF;

    // 🔴 DELTA INVERTITO (sale)
    const calloutY = CALL_OUT_BASE_Y - i * CALL_OUT_DELTA_Y;

    const yBottom = Y_RULER + 18;
    const yTop = calloutY + 40;

    // ===== LINEA VERTICALE =====
    ctx.strokeStyle = RED;
    ctx.lineWidth = LINE_W;
    ctx.beginPath();
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x, yTop);
    ctx.stroke();

    // ===== PALLINI =====
    ctx.fillStyle = RED;

    ctx.beginPath();
    ctx.arc(x, Y_DOT_RIGHT, DOT_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, Y_DOT_LEFT, DOT_R, 0, Math.PI * 2);
    ctx.fill();

    // ===== LEADER (VERSO SINISTRA) =====
    const LEADER_LEN = 120;
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x - LEADER_LEN, yTop);
    ctx.stroke();

    // ===== TESTO + BOX (A SINISTRA) =====
    const stLabel = Number.isInteger(s.n) ? String(s.n) : s.n.toFixed(1);
    const line1 = `STATION ${stLabel}`;
    const line2 = `${Math.round(s.kg)} kg`;

    const PAD_X = 18;
    const PAD_Y = 14;

    // font per misure
    ctx.font = "bold 44px Helvetica";
    const m1 = ctx.measureText(line1);
    ctx.font = "bold 42px Helvetica";
    const m2 = ctx.measureText(line2);

    const boxW = Math.max(m1.width, m2.width) + PAD_X * 2;
    const boxH = 44 + 42 + PAD_Y * 3;

    // posizione box (a SINISTRA del leader)
    const boxX = x - LEADER_LEN - boxW;
    const boxY = calloutY - PAD_Y;

    // BOX
    ctx.fillStyle = "#4182ecff";
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = LINE_W;

    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    // TESTO
    ctx.fillStyle = BLACK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = "bold 44px Helvetica";
    ctx.fillText(line1, boxX + PAD_X, calloutY);

    ctx.font = "bold 42px Helvetica";
    ctx.fillText(line2, boxX + PAD_X, calloutY + 44 + PAD_Y);
  });
}

// ==================================================
// PICK VARIANT (default 10-01)
// ==================================================
const variant = (process.argv[2] ?? "10-01") as "10-01" | "10-02" | "10-03";

const scenarioByVariant: Record<typeof variant, any> = {
  "10-01": scenarioManta1001,
  "10-02": scenarioManta1002,
  "10-03": scenarioManta1003
};

const statePathByVariant: Record<typeof variant, string> = {
  "10-01": "state/manta_10_01.config.json",
  "10-02": "state/manta_10_02.config.json",
  "10-03": "state/manta_10_03.config.json"
};

const scenario = scenarioByVariant[variant];
const stateConfig = loadJsonIfExists(statePathByVariant[variant]);

const pdfInputPath = "state/ui_input.runtime.json";
const uiDelta = fs.existsSync(pdfInputPath)
  ? JSON.parse(fs.readFileSync(pdfInputPath, "utf-8"))
  : {};

  // =============================
// OPTIONAL FLIGHT INFO (for PDF export)
// =============================
const withFlightInfo = process.argv.includes("--with-flight-info");
const exportPdf = process.argv.includes("--pdf");
const cargoLayoutTest = process.argv.includes("--cargo-layout-test");

const flightInfoPath = "state/flight_info.runtime.json";
const flightInfo = (withFlightInfo && fs.existsSync(flightInfoPath))
  ? JSON.parse(fs.readFileSync(flightInfoPath, "utf-8"))
  : null;

// Template PNG per variante
const IMAGE_PATH =
  cargoLayoutTest
    ? "./ui/assets/atr_cargo_layout.png"
    : (variant === "10-01" ? "./ui/assts/wb_page-1.png" : "./ui/assets/wb_page-2e3.png");
// ==================================================
// COORD TRANSFORM (ONLY for 10-02 / 10-03)
// - 10-01 => identity (non cambia NULLA)
// - 10-02/10-03 => scale+offset calcolati dalle tue 3 coordinate note
// ==================================================
const TRANSFORM =
  variant === "10-01"
    ? { sx: 1, bx: 0, sy: 1, by: 0 }
    : (() => {
        // X: (865 -> 1115), (3680 -> 5330)
        const x1 = 865,  x1p = 1115;
        const x2 = 3680, x2p = 5330;
        const sx = (x2p - x1p) / (x2 - x1);
        const bx = x1p - sx * x1;

        // Y: (745 -> 835), (3435 -> 4875)
        const y1 = 745,  y1p = 835;
        const y2 = 3435, y2p = 4875;
        const sy = (y2p - y1p) / (y2 - y1);
        const by = y1p - sy * y1;

        return { sx, bx, sy, by };
      })();

function Tx(x: number): number {
  return x * TRANSFORM.sx + TRANSFORM.bx;
}
function Ty(y: number): number {
  return y * TRANSFORM.sy + TRANSFORM.by;
}
// scala “misure” (font, lineWidth, raggi) in modo uniforme
function S(v: number): number {
  const s = (TRANSFORM.sx + TRANSFORM.sy) / 2;
  return v * s;
}
function Tpt(p: { x: number; y: number }) {
  return { x: Tx(p.x), y: Ty(p.y) };
}

// ==================================================
// LOAD DATASET + MERGE INPUT (come la CLI)
// ==================================================
const dataset = JSON.parse(fs.readFileSync(scenario.datasetPath, "utf-8"));

const mergedInput = {
  ...scenario.input,
  ...stateConfig,
  ...uiDelta
};

// validazione
const validation = validateInput(dataset, mergedInput);
if (!validation.valid) {
  console.error("❌ Invalid input:");
  for (const e of validation.errors) console.error(`- ${e.field}: ${e.message}`);
  process.exit(1);
}

// ==================================================
// RUN ENGINE
// ==================================================
const result: any = computeWB(dataset, mergedInput);
const input: any = mergedInput;

// ==================================================
// DERIVED VALUES
// ==================================================

// --- LT BASE (DOW LT BASE) ---
// ⚠️ arrotondato UNA SOLA VOLTA come CLI (per eccesso)
const ltBaseWeight = Math.ceil(Number(result.loadTrimBaseWeight ?? 0));
const ltBaseIndex = Number(result.loadTrimBaseIndex ?? 0);
const percentMacLtBase = indexToPercentMAC(ltBaseIndex, ltBaseWeight);

// --- BASIC INDEX CORRECTION ---
type Zone = "D" | "E" | "F" | "G";
const zoneCoeff: Record<Zone, number> = { D: -0.67, E: +0.52, F: +0.69, G: -0.32 };

const corr = input.basicIndexCorrection ?? {};
const corrKgTotal =
  Number(corr.D ?? 0) +
  Number(corr.E ?? 0) +
  Number(corr.F ?? 0) +
  Number(corr.G ?? 0);

let corrDeltaIndexTotal = 0;
for (const z of ["D", "E", "F", "G"] as Zone[]) {
  const kg = Number(corr[z] ?? 0);
  if (kg) corrDeltaIndexTotal += (kg / 10) * zoneCoeff[z];
}

// --- CABIN ---
const cabinStations = dataset.cabinCrewStations ?? [];
const cabinOcc = input.cabinCrewOccupants ?? {};

const cabinDeltaById: Record<string, number> = {};
let totalCabinMembers = 0;
let totalCabinWeight = 0;
let totalCabinIndex = 0;

for (const s of cabinStations) {
  const n = Number(cabinOcc[s.id] ?? 0);
  if (n <= 0) continue;

  const nUsed = Math.min(n, Number(s.maxPersons ?? n));
  const unitW = Number(s.unitWeightKg ?? dataset.standardPersonKg ?? 90);

  const deltaIdx = nUsed * Number(s.deltaIndexPerPerson ?? 0);
  const w = nUsed * unitW;

  cabinDeltaById[s.id] = deltaIdx;
  totalCabinMembers += nUsed;
  totalCabinWeight += w;
  totalCabinIndex += deltaIdx;
}

const sumDelta = (ids: string[]) =>
  ids.reduce((s, id) => s + (cabinDeltaById[id] ?? 0), 0);

const op1Delta = cabinDeltaById["OPERATOR_1"] ?? 0;
const op2Delta = cabinDeltaById["OPERATOR_2"] ?? 0;
const debrief1Delta = cabinDeltaById["DEBRIEF_ROW1"] ?? 0;
const debrief2Delta = cabinDeltaById["DEBRIEF_ROW2"] ?? 0;
const rest1Delta = cabinDeltaById["REST_ROW1"] ?? 0;
const rest2Delta = cabinDeltaById["REST_ROW2"] ?? 0;
const observersDelta = sumDelta(Object.keys(cabinDeltaById).filter(id => id.startsWith("OBSERVER_")));

// --- CARGO ---
const lh = Number(input.cargoKg?.LH_FW ?? 0);
const rh = Number(input.cargoKg?.RH_FW ?? 0);
const aft = Number(input.cargoKg?.AFT ?? 0);
const ballast = Number(input.cargoKg?.BALLAST ?? 0);

const fwdCargo = lh + rh;
const aftCargo = aft + ballast;
const totalCargo = fwdCargo + aftCargo;

// --- FUEL ---
const takeoffFuelKg = Number(input.takeoffFuelKg ?? 0);
const tripFuelKg = Number(input.tripFuelKg ?? 0);

// --- TOTAL INDEX ---
const correctedDryIndex = Number(result.correctedDryOperatingIndex ?? 0);
const totalIndex = correctedDryIndex + totalCabinIndex;

// ==================================================
// FIELD MAP
// ==================================================
const FIELDS = [
  { v: W(ltBaseWeight),     x: 865,  y: 745 },
  { v: I(percentMacLtBase), x: 1195, y: 745 },
  { v: I(ltBaseIndex),      x: 1195, y: 955 },

  { v: totalCabinMembers.toString(), x: 1725, y: 915 },
  { v: W(totalCabinWeight),          x: 1885, y: 1055 },

  { v: W(lh),         x: 2655, y: 645 },
  { v: W(rh),         x: 2655, y: 745 },
  { v: W(aftCargo),   x: 2655, y: 845 },
  { v: W(totalCargo), x: 2655, y: 955 },

  { v: W(ltBaseWeight),                       x: 3680, y: 655 },
  { v: W(corrKgTotal),                        x: 3680, y: 745 },
  { v: W(result.correctedDryOperatingWeight), x: 3680, y: 850 },
  { v: W(totalCargo),                         x: 3680, y: 955 },
  { v: W(totalCabinWeight),                   x: 3680, y: 1055 },
  { v: W(result.zeroFuelWeight),              x: 3680, y: 1150 },
  { v: W(takeoffFuelKg),                      x: 3680, y: 1240 },
  { v: W(result.takeoffWeight),               x: 3680, y: 1335 },
  { v: W(tripFuelKg),                         x: 3680, y: 1435 },
  { v: W(result.landingWeight),               x: 3680, y: 1535 },

  { v: W(corr.D ?? 0), x: 1090, y: 1435 },
  { v: W(corr.E ?? 0), x: 1205, y: 1435 },
  { v: W(corr.F ?? 0), x: 1320, y: 1435 },
  { v: W(corr.G ?? 0), x: 1435, y: 1435 },

  { v: I(corrDeltaIndexTotal), x: 1400, y: 2625 },

  { v: I(correctedDryIndex), x: 2350, y: 2620 },
  { v: I(correctedDryIndex), x: 3315, y: 3430 },

  { v: I3(op1Delta),       x: 2355, y: 2920 },
  { v: I3(op2Delta),       x: 2355, y: 2995 },
  { v: I3(debrief1Delta),  x: 2355, y: 3070 },
  { v: I3(debrief2Delta),  x: 2355, y: 3140 },
  { v: I3(rest1Delta),     x: 2355, y: 3210 },
  { v: I3(rest2Delta),     x: 2355, y: 3285 },
  { v: I3(observersDelta), x: 2355, y: 3355 },

  { v: I3(totalCabinIndex), x: 2355, y: 3430 },
  { v: I3(totalCabinIndex), x: 2830, y: 3435 },

  { v: I(totalIndex), x: 3835, y: 3435 },

  { v: W(fwdCargo),      x: 1185, y: 3750 },
  { v: W(aftCargo),      x: 1185, y: 3855 },
  { v: W(takeoffFuelKg), x: 1185, y: 4010 }
];

// ==================================================
// RENDER
// ==================================================
(async () => {
 const img = await loadImage(IMAGE_PATH);
const canvas = exportPdf
  ? createCanvas(img.width, img.height, "pdf")
  : createCanvas(img.width, img.height);
const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);

    // =============================
  // CARGO LAYOUT OVERLAY TEST (PNG)
  // =============================
  if (cargoLayoutTest) {
    const stations = getCargoStationsFromRuntime();
    drawCargoStationsOverlay(ctx, stations);

    fs.mkdirSync("./render", { recursive: true });
    const out = "./render/cargo_layout_test.png";
    fs.writeFileSync(out, canvas.toBuffer("image/png"));
    console.log("✔️ Cargo layout test exported:", out);
    return; // IMPORTANT: non proseguire col render WB normale
  }

  // =============================
// FLIGHT INFO (only on export)
// =============================
if (flightInfo) {
  const F = flightInfo;

  ctx.save();
  ctx.font = `${S(42)}px Helvetica`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(String(F.aircraftRegistration ?? ""), Tx(1145), Ty(4645));
  ctx.fillText(String(F.date ?? ""),               Tx(1145), Ty(4790));
  ctx.fillText(String(F.flightNumber ?? ""),       Tx(1145), Ty(4945));
  ctx.fillText(String(F.depIcao ?? ""),      Tx(1065), Ty(5090));
  ctx.fillText(String(F.arrIcao ?? ""),        Tx(1065), Ty(5230));
  ctx.fillText(String(F.preparedBy ?? ""),         Tx(980),  Ty(5500));
  ctx.fillText(String(F.approvedBy ?? ""),         Tx(980),  Ty(5790));

  ctx.restore();
}

  // font cell numbers (scalato per 10-02/10-03, identico per 10-01)
  const cellFontPx = S(42);
  ctx.font = `${cellFontPx}px Helvetica`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // celle numeriche: applico SOLO trasformazione coordinate per 10-02/10-03
  for (const f of FIELDS) {
    const p = Tpt({ x: f.x, y: f.y });
    ctx.fillText(f.v, p.x, p.y);
  }

  // ==================================================
  // TEXT BLOCK – DRY OPERATING WEIGHT ITEMS
  // ==================================================
  ctx.save();

  ctx.font = `${S(56)}px Helvetica`;
  ctx.fillStyle = "#1b8f3a"; // verde
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textX = Tx(2165);
  const startY = Ty(1180);
  const lineH = S(64);

  const cm3Text = input.cm3Installed ? "PRESENTE" : "NON PRESENTE";
  const crewBaggageKg = Number(input.crewBaggageKg ?? 0);

  const cargoStationsKg = input.cargoStationsKg ?? {};
  const totalCargoStationsKg = Object.values(cargoStationsKg)
    .reduce((s, v) => s + Number(v ?? 0), 0);

  const lines = [
    "ITEMS GIÀ CALCOLATI NELLA",
    "DRY OPERATING WEIGHT CONDITION",
    "CM1 e CM2",
    `CM3: ${cm3Text}`,
    `CREW BAGGAGE: ${W(crewBaggageKg)} kg`,
    "DOTAZIONI SV",
    `CARGO STATIONS: ${W(totalCargoStationsKg)} kg totali`
  ];

  lines.forEach((line, i) => {
    ctx.fillText(line, textX, startY + i * lineH);
  });

  ctx.restore();

    // ==================================================
  // MEGA GRAPH (INDEX + ENVELOPE) — coordinate mapping
  // ==================================================
  // ⚠️ Qui NON applichiamo TRANSFORM: usiamo i box reali dei grafici per ogni pagina.
 const MEGA =
  variant === "10-01"
    ? {
        xLeft: 1717,
        xRight: 3824,
        yTop: 3708,
        yBottom: 5791,
        idxMin: -56,
        idxMax: 52,
        wMax: 21450,
        wMin: 10000,
        xOffset: 0
      }
    : {
        // 10-02 / 10-03
        xLeft: 2370,
        xRight: 5542,
        yTop: 5298,
        yBottom: 8427,
        idxMin: -56,
        idxMax: 52,
        wMax: 21450,
        wMin: 10000,
        xOffset: -1 // ← micro-correzione a sinistra
      };

function mapX(index: number): number {
  const t = (index - MEGA.idxMin) / (MEGA.idxMax - MEGA.idxMin);
  return (
    MEGA.xLeft +
    t * (MEGA.xRight - MEGA.xLeft) +
    MEGA.xOffset
  );
}

  function mapY(weightKg: number): number {
    const t = (MEGA.wMax - weightKg) / (MEGA.wMax - MEGA.wMin);
    return MEGA.yTop + t * (MEGA.yBottom - MEGA.yTop);
  }

  // Punto in pixel reali del grafico (nessuna transform qui)
  function pt(index: number, weightKg: number) {
    return { x: mapX(index), y: mapY(weightKg) };
  }

  function drawPolyline(points: Array<{ x: number; y: number }>, strokeStyle: string, lineWidth: number) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = S(lineWidth);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawDot(p: { x: number; y: number }, radiusPx: number) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, S(radiusPx), 0, Math.PI * 2);
    ctx.fillStyle = "#0033aa"; // pallini blu
    ctx.fill();
  }

  function drawTriangle(p: { x: number; y: number }, sizePx: number) {
    const h = S(sizePx);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h / 2);        // punta in alto
    ctx.lineTo(p.x - h / 2, p.y + h / 2);
    ctx.lineTo(p.x + h / 2, p.y + h / 2);
    ctx.closePath();
    ctx.fillStyle = "#ddac0a";           // giallo
    ctx.fill();
  }

  function drawX(p: { x: number; y: number }, sizePx: number) {
    const h = S(sizePx) / 2;
    ctx.strokeStyle = "#800080"; // viola
    ctx.lineWidth = S(4);
    ctx.beginPath();
    ctx.moveTo(p.x - h, p.y - h);
    ctx.lineTo(p.x + h, p.y + h);
    ctx.moveTo(p.x - h, p.y + h);
    ctx.lineTo(p.x + h, p.y - h);
    ctx.stroke();
  }

  function drawDashedArrowToIndex(from: { x: number; y: number }, targetIndex: number, color: string) {
    // targetIndex -> x in coordinate 10-01, poi trasformo SOLO X
    const toX = mapX(targetIndex);
    const y = from.y;

    ctx.save();
    ctx.setLineDash([S(20), S(14)]);
    ctx.strokeStyle = color;
    ctx.lineWidth = S(8);
    ctx.beginPath();
    ctx.moveTo(from.x, y);
    ctx.lineTo(toX, y);
    ctx.stroke();
    ctx.restore();

    const arrowSize = S(36);
    const direction = toX < from.x ? -1 : 1;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, y);
    ctx.lineTo(toX - direction * arrowSize, y - arrowSize / 2);
    ctx.lineTo(toX - direction * arrowSize, y + arrowSize / 2);
    ctx.closePath();
    ctx.fill();
  }

  // ==================================================
  // INDICI intermedi (coerenti con engine)
  // ==================================================
  const entryIndex = totalIndex;

  const indexAfterFwd = entryIndex - (fwdCargo / 50) * 2.65;
  const indexAfterAft = indexAfterFwd + (aftCargo / 50) * 3.8;

  const takeoffIndex = Number(result.takeoffIndex ?? 0);
  const landingIndex = Number(result.landingIndex ?? 0);

  const takeoffWeight = Number(result.takeoffWeight ?? 0);
  const landingWeight = Number(result.landingWeight ?? 0);

  // ==================================================
  // PUNTI (ordine esatto che mi hai dato)
  // ==================================================
  const P = {
    entry0: pt(entryIndex, 21450),
    entry1: pt(entryIndex, 21200),

    fwd0: pt(indexAfterFwd, 21200),
    fwd1: pt(indexAfterFwd, 20700),

    aft0: pt(indexAfterAft, 20700),
    aft1: pt(indexAfterAft, 19825),

    fuel0: pt(takeoffIndex, 19825),          // index TAKEOFF, peso fittizio
    tow:   pt(takeoffIndex, takeoffWeight),  // TAKEOFF condition reale (envelope)

    lw:    pt(landingIndex, landingWeight),  // LANDING condition reale

    lf:    pt(landingIndex, 19825)           // LF: peso fittizio 19825, index landing
  };

  const redPath = [P.entry0, P.entry1, P.fwd0, P.fwd1, P.aft0, P.aft1, P.fuel0, P.tow];
  drawPolyline(redPath, "#ff0000", 10);

  drawPolyline([P.tow, P.lw], "#0066ff", 10);
  drawPolyline([P.lf, P.lw], "#00aa00", 10);

  const dots = [P.entry1, P.fwd0, P.fwd1, P.aft0, P.aft1, P.fuel0, P.tow, P.lw, P.lf];
  for (const d of dots) drawDot(d, 10);

  const zfwIndex = Number(result.zeroFuelIndex ?? 0);
  const zfwWeight = Number(result.zeroFuelWeight ?? 0);
  const zfwPt = pt(zfwIndex, zfwWeight);
  drawDashedArrowToIndex(
  { x: zfwPt.x, y: zfwPt.y },
  - 59,
  "#800080" // viola (usa lo stesso che stai già usando altrove)
);

  drawDashedArrowToIndex(P.tow, -59, "#ff0000");
  drawDashedArrowToIndex(P.lw,  -59, "#00aa00");

  // ---- %MAC TAKEOFF ----
  const takeoffPercentMac = indexToPercentMAC(takeoffIndex, takeoffWeight);

  const MAC_MIN = 11.9;
  const MAC_MAX = 37.05;

    function mapXMac(mac: number): number {
    const t = (mac - MAC_MIN) / (MAC_MAX - MAC_MIN);
    return MEGA.xLeft + t * (MEGA.xRight - MEGA.xLeft);
  }

  const macPoint = { x: mapXMac(takeoffPercentMac), y: mapY(19000) };
  drawTriangle(macPoint, 48);
  drawPolyline([P.tow, macPoint], "#ddac0a", 10);

  // ==================================================
  // TRIM GRAPH (grafico separato)
  // ==================================================
    const TRIM =
    variant === "10-01"
      ? {
          xLeft: 1633,
          xRight: 3554,
          yTop: 5975,
          yBottom: 6292,
          trimMin: -4.5,
          trimMax: 1.5
        }
      : {
          // 10-02 / 10-03
          xLeft: 2241,
          xRight: 5133,
          yTop: 8711,
          yBottom: 9168,
          trimMin: -4.5,
          trimMax: 1.5
        };

  function mapXTrim(trim: number): number {
    const t = (trim - TRIM.trimMin) / (TRIM.trimMax - TRIM.trimMin);
    return TRIM.xLeft + t * (TRIM.xRight - TRIM.xLeft);
  }

  const takeoffTrim = Number(result.takeoffTrim ?? 0);

  const trimX = mapXTrim(takeoffTrim);
  const trimYTop = TRIM.yTop;
  const trimYBottom = TRIM.yBottom;

  ctx.fillStyle = "#ddac0a";

  ctx.beginPath();
  ctx.arc(trimX, trimYTop, S(2.5), 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(trimX, trimYBottom, S(2.5), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ddac0a";
  ctx.lineWidth = S(10);
  ctx.beginPath();
  ctx.moveTo(trimX, trimYTop);
  ctx.lineTo(trimX, trimYBottom);
  ctx.stroke();

  // ==================================================
  // FMS PERFORMANCE TABLE (ROTATED 90° RIGHT)
  // ==================================================
  const FMS_CENTER_X = Tx(4500);
  const FMS_CENTER_Y = Ty(5000);
  const FMS_ROT_RAD = Math.PI / 2;

  const KG = (v: number) => Math.round(v).toLocaleString("it-IT");

  const oewCorrectedKgFms = Number(result.correctedWeight ?? 0);

  const svKgFms = (result.breakdown ?? [])
    .filter((l: any) => typeof l?.label === "string" && l.label.startsWith("SV:"))
    .reduce((s: number, l: any) => s + (Number(l.weightKg ?? 0) || 0), 0);

  const ballastKgFms = Number(input.cargoKg?.BALLAST ?? 0);

  const basicOperatingWeightKgFms = oewCorrectedKgFms + svKgFms + ballastKgFms;

  const fuelKgFms = Number(input.takeoffFuelKg ?? 0);

  const crewBaggageKgFms = Number(input.crewBaggageKg ?? 0);
  const cargoKgFms =
    Number(input.cargoKg?.LH_FW ?? 0) +
    Number(input.cargoKg?.RH_FW ?? 0) +
    Number(input.cargoKg?.AFT ?? 0) +
    totalCargoStationsKg +
    crewBaggageKgFms;

  const totalCabinMembersFms = Object.values(input.cabinCrewOccupants ?? {}).reduce(
    (a: number, b: any) => a + (Number(b) || 0),
    0
  );

  const cm3ExtraFms = input.cm3Installed === true ? 1 : 0;
  const crewPaxCountFms = Math.max(0, totalCabinMembersFms - 1 + cm3ExtraFms);

  const grossWtKgFms =
    basicOperatingWeightKgFms +
    fuelKgFms +
    cargoKgFms +
    crewPaxCountFms * 90;

  const fmsTitle = "DATI DA INSERIRE NELLA PERFORMANCE INITIAL DELL'FMS";
  const fmsRows = [
    { label: "BASIC OPERATING WEIGHT (O.E.W. CORRECTED + SV + BALLAST)", value: KG(basicOperatingWeightKgFms) },
    { label: "FUEL", value: KG(fuelKgFms) },
    { label: "CARGO", value: KG(cargoKgFms) },
    { label: "CREW/PAX (ESCLUSO MINIMUM CREW - CM1/CM2/TEV1)", value: KG(crewPaxCountFms) },
    { label: "GROSS WT", value: KG(grossWtKgFms) }
  ];

  const ROW_GAP_FMS = S(70);
  const TITLE_GAP_FMS = S(85);
  const LABEL_FONT_FMS = `${S(56)}px Helvetica`;
  const TITLE_FONT_FMS = `${S(56)}px Helvetica`;

  ctx.save();
  ctx.translate(FMS_CENTER_X, FMS_CENTER_Y);
  ctx.rotate(FMS_ROT_RAD);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const totalHeightFms = TITLE_GAP_FMS + (fmsRows.length - 1) * ROW_GAP_FMS;
  const startYFms = -totalHeightFms / 2;

  ctx.font = TITLE_FONT_FMS;
  ctx.fillStyle = "#000000";
  ctx.fillText(fmsTitle, 0, startYFms);

  ctx.font = LABEL_FONT_FMS;

  for (let i = 0; i < fmsRows.length; i++) {
    const y = startYFms + TITLE_GAP_FMS + i * ROW_GAP_FMS;
    const r = fmsRows[i];

    if (i === 0) ctx.fillStyle = "#0057b8";
    else if (i === fmsRows.length - 1) ctx.fillStyle = "#1b8f3a";
    else ctx.fillStyle = "#000000";

    ctx.fillText(`${r.label}   ${r.value}`, 0, y);
  }

  ctx.restore();

  if (exportPdf) {
  fs.writeFileSync("./wb_filled_test.pdf", canvas.toBuffer());
  console.log("✔️ PDF export completed: ./wb_filled_test.pdf");
} else {
  fs.mkdirSync("./render", { recursive: true});
  fs.writeFileSync(OUTPUT_PATH, canvas.toBuffer("image/png"));
  console.log("✔️ Render test completed:", OUTPUT_PATH);
}
console.log(`Variant: ${variant}`);
})();