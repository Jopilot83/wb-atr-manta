// tools/export_pdf_from_png.ts
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import PDFDocument from "pdfkit";

function formatDateIT(input?: string): string {
  if (!input) return "";

  // accetta YYYY-MM-DD
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return input; // se è già formattata o strana, non tocchiamo

  const [, y, mm, d] = m;
  return `${d}.${mm}.${y}`;
}

const PNG_PATH = "./wb_filled_test.png";
const FLIGHT_INFO_PATH = "state/flight_info.runtime.json";

// (se presente) pagina 2 già generata dal test cargo overlay
const CARGO_PNG_PATH = path.join(process.cwd(), "render", "cargo_layout_test.png");

// ====== coordinate 10-01 (le tue) ======
const POS_10_01 = {
  aircraftRegistration: { x: 1100, y: 4645 },
  date:                { x: 1100, y: 4790 },
  flightNumber:        { x: 1100, y: 4945 },
  depIcao:             { x: 1020, y: 5090 },
  arrIcao:             { x: 1020, y: 5230 },
  preparedBy:          { x:  935, y: 5500 },
  approvedBy:          { x:  935, y: 5790 }
};

// ====== stesso transform che usi in render_test_page.ts ======
function getTransform(variant: string) {
  if (variant === "10-01") return { sx: 1, bx: 0, sy: 1, by: 0 };

  // 10-02 / 10-03 (identico a render_test_page.ts)
  const x1 = 865,  x1p = 1115;
  const x2 = 3680, x2p = 5330;
  const sx = (x2p - x1p) / (x2 - x1);
  const bx = x1p - sx * x1;

  const y1 = 745,  y1p = 835;
  const y2 = 3435, y2p = 4875;
  const sy = (y2p - y1p) / (y2 - y1);
  const by = y1p - sy * y1;

  return { sx, bx, sy, by };
}

function Tx(x: number, t: any) { return x * t.sx + t.bx; }
function Ty(y: number, t: any) { return y * t.sy + t.by; }
function S(v: number, t: any)  { return v * ((t.sx + t.sy) / 2); }

function readFlightInfo(): any {
  if (!fs.existsSync(FLIGHT_INFO_PATH)) return {};
  return JSON.parse(fs.readFileSync(FLIGHT_INFO_PATH, "utf-8"));
}
function buildPdfFilename(variant: string, fi: any): string {
  const version = (variant || "UNKNOWN").toString().trim();

  const dep = (fi?.depIcao ?? "").toString().trim();
  const arr = (fi?.arrIcao ?? "").toString().trim();
  const route = dep && arr ? `${dep}-${arr}` : "";

  const dateRaw = (formatDateIT(fi.date) ?? "").toString().trim();
  const date = dateRaw.length ? dateRaw : "";

  const name = `W&B MANTA ${version} ${route} ${date}.pdf`;

  // sanitizza caratteri non validi per filename
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

async function buildPngWithFlightInfo(variant: string): Promise<{ pngBuffer: Buffer; w: number; h: number }> {
  if (!fs.existsSync(PNG_PATH)) {
    throw new Error(`PNG not found: ${PNG_PATH}`);
  }

  const img = await loadImage(PNG_PATH);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // base
  ctx.drawImage(img, 0, 0);

  // overlay flight info (se presente)
  const fi = readFlightInfo();
  const t = getTransform(variant);
  const pos = POS_10_01;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${S(42, t)}px Helvetica`;

  const write = (key: keyof typeof pos, value: any) => {
    const v = (value ?? "").toString().trim();
    if (!v) return;
    ctx.fillText(v, Tx(pos[key].x, t), Ty(pos[key].y, t));
  };

  write("aircraftRegistration", fi.aircraftRegistration);
  write("date", formatDateIT(fi.date));
  write("flightNumber", fi.flightNumber);
  write("depIcao", fi.depIcao);
  write("arrIcao", fi.arrIcao);
  write("preparedBy", fi.preparedBy);
  write("approvedBy", fi.approvedBy);

  ctx.restore();

  const pngBuffer = canvas.toBuffer("image/png");
  return { pngBuffer, w: img.width, h: img.height };
}

async function readCargoPngIfExists(): Promise<{ buf: Buffer; w: number; h: number } | null> {
  if (!fs.existsSync(CARGO_PNG_PATH)) return null;

  const img = await loadImage(CARGO_PNG_PATH);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  return { buf: canvas.toBuffer("image/png"), w: img.width, h: img.height };
}

(async () => {
  const variant = String(process.argv[2] ?? "10-01");

  // 1) costruisci PNG pagina 1 con flight info (canvas OK)
  const page1 = await buildPngWithFlightInfo(variant);

  // 2) (opzionale) carica pagina 2 cargo (già pronta in render/)
  const page2 = await readCargoPngIfExists();

  // 3) PDF VALIDO con pdfkit
  const fi = readFlightInfo();
const pdfFilename = buildPdfFilename(variant, fi);
fs.mkdirSync("render", { recursive: true }); // sicurezza
const pdfPath = path.join("render", pdfFilename);

const doc = new PDFDocument({ autoFirstPage: false });
const out = fs.createWriteStream(pdfPath);
doc.pipe(out);

  // Pagina 1: dimensione = pixel dell’immagine (così le coordinate restano coerenti al 100%)
  doc.addPage({ size: [page1.w, page1.h] });
  doc.image(page1.pngBuffer, 0, 0, { width: page1.w, height: page1.h });

  // Pagina 2 (se presente): CARGO LAYOUT, A4, RUOTATA 90° A SINISTRA
if (page2) {
  doc.addPage({ size: [page2.w, page2.h] });

  // disegna la PNG "così com'è" (orizzontale, piena pagina)
  doc.image(page2.buf, 0, 0, { width: page2.w, height: page2.h });

  // ✅ ruota TUTTA la pagina per la visualizzazione (metadato /Rotate)
  // 90 = ruota a destra, 270 = ruota a sinistra
  // tu hai chiesto 90° a sinistra -> 270
  (doc as any).page.dictionary.data.Rotate = 270;
}

  doc.end();

  await new Promise<void>((resolve) => out.on("finish", () => resolve()));
  // stampa SOLO il filename per il server
console.log(`PDF_PATH::${pdfPath}`);
})().catch((e) => {
  console.error("❌ export_pdf_from_png failed:", e);
  process.exit(1);
});