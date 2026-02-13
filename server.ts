import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

import { computeWB } from "./src/engine.ts";
import { validateInput } from "./src/validation/validateInput.ts";
import PDFDocument from "pdfkit";

// =============================
// CONFIG
// =============================
const PORT = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.json());

// =============================
// STATIC UI
// =============================
const UI_DIR = path.join(process.cwd(), "ui");
app.use(express.static(UI_DIR)); // / -> ui/*
app.get("/", (_req, res) => {
  res.sendFile(path.join(UI_DIR, "index.html"));
});

// Render output served from project root (wb_filled_test.png lives there)
app.use("/render", express.static(process.cwd()));
app.use("/render", express.static("render"));

async function loadScenario(variant: string) {
  switch (variant) {
    case "10-01":
      return await import("./src/scenarios/manta_10_01.standard.ts");
    case "10-02":
      return await import("./src/scenarios/manta_10_02.standard.ts");
    case "10-03":
      return await import("./src/scenarios/manta_10_03.standard.ts");
    default:
      throw new Error(`Unknown variant ${variant}`);
  }
}

// =============================
// LOAD SCENARIO MODULE BY VARIANT
// =============================
async function loadScenarioModule(variant: string) {
  switch (variant) {
    case "10-01":
      return await import("./src/scenarios/manta_10_01.standard.ts");
    case "10-02":
      return await import("./src/scenarios/manta_10_02.standard.ts");
    case "10-03":
      return await import("./src/scenarios/manta_10_03.standard.ts");
    default:
      throw new Error(`Unknown variant ${variant}`);
  }
}

function pickScenarioFromModule(mod: any, variant: string) {
  // i tuoi file esportano scenarioManta1001/1002/1003
  if (variant === "10-01") return mod.scenarioManta1001;
  if (variant === "10-02") return mod.scenarioManta1002;
  if (variant === "10-03") return mod.scenarioManta1003;

  // fallback
  return mod.scenario ?? mod.default ?? null;
}

// =============================
// API: scenario standard (NO merge, NO runtime)
// =============================
app.get("/scenario/:variant", async (req, res) => {
  try {
    const variant = req.params.variant;
    const mod: any = await loadScenarioModule(variant);
    const scenario = pickScenarioFromModule(mod, variant);

    if (!scenario?.input || !scenario?.datasetPath) {
      return res.status(500).json({ ok: false, error: "Scenario not found" });
    }

    // SOLO scenario standard
    return res.json({ ok: true, input: scenario.input});
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// =============================
// API: get config items (READ ONLY)
// =============================
app.get("/config-items/:variant", async (req, res) => {
  try {
    const variant = req.params.variant;

    // carica scenario (datasetPath)
    const mod: any = await loadScenarioModule(variant);
    const scenario =
      mod.scenarioManta1001 ??
      mod.scenarioManta1002 ??
      mod.scenarioManta1003;

    if (!scenario?.datasetPath) {
      throw new Error("Dataset path not found for variant");
    }

    const dataset = JSON.parse(
      fs.readFileSync(scenario.datasetPath, "utf-8")
    );

    // carica state (persistente)
    const statePath = `state/manta_${variant.replace("-", "_")}.config.json`;
    const state = fs.existsSync(statePath)
      ? JSON.parse(fs.readFileSync(statePath, "utf-8"))
      : { configState: {} };

    res.json({
      ok: true,
      configItems: dataset.configItems ?? [],
      configState: state.configState ?? {}
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// =============================
// API: Weighing info (all variants)
// =============================
app.get("/weighing-info", (req, res) => {
  try {
    const variants = [
      { id: "10-01", datasetPath: "datasets/atr_manta_10_01.json", label: "MANTA 10-01" },
      { id: "10-02", datasetPath: "datasets/atr_manta_10_02.json", label: "MANTA 10-02" },
      { id: "10-03", datasetPath: "datasets/atr_manta_10_03.json", label: "MANTA 10-03" }
    ];

    const info = variants.map(v => {
      const ds = JSON.parse(fs.readFileSync(v.datasetPath, "utf-8"));

      return {
        label: v.label,
        weighingDate: ds.weighingDate ?? "N/A",
        weighingWeightKg:
          ds.weighedWeight?.weightKg ?? 
          null
      };
    });

    res.json({ ok: true, info });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =============================
// API: save config items (persistente)
// =============================
app.post("/config-items/:variant", async (req, res) => {
  try {
    const variant = String(req.params.variant ?? "10-01");
    const nextConfigState = req.body?.configState;

    if (!nextConfigState || typeof nextConfigState !== "object") {
      return res.status(400).json({ ok: false, error: "configState missing/invalid" });
    }

    // mappa file state per variante
    const statePath =
      variant === "10-01" ? "state/manta_10_01.config.json" :
      variant === "10-02" ? "state/manta_10_02.config.json" :
      variant === "10-03" ? "state/manta_10_03.config.json" :
      null;

    if (!statePath) {
      return res.status(400).json({ ok: false, error: `Unknown variant ${variant}` });
    }

    // leggi state corrente, aggiorna SOLO configState
    let current: any = {};
    try {
      current = JSON.parse(fs.readFileSync(statePath, "utf-8"));
    } catch {
      current = {};
    }

    const next = {
      ...current,
      configState: nextConfigState
    };

    fs.mkdirSync("state", { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(next, null, 2), "utf-8");

    return res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// =============================
// PRINT CONFIGURATION (DATA ONLY)
// =============================
app.post("/config-items/:variant/print", async (req, res) => {
  console.log(">>> PRINT CONFIG DATA ROUTE HIT", req.params.variant);
  try {
    const variantShort = req.params.variant; // "10-01"

    const datasetPath = `datasets/atr_manta_${variantShort.replace("-", "_")}.json`;
    const statePath   = `state/manta_${variantShort.replace("-", "_")}.config.json`;

    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset not found: ${datasetPath}`);
    }
    if (!fs.existsSync(statePath)) {
      throw new Error(`Config state not found: ${statePath}`);
    }

    const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
    const state   = JSON.parse(fs.readFileSync(statePath, "utf-8"));

    const configItems = dataset.configItems ?? [];
    const configState = state.configState ?? {};

    const rows = configItems.map((item: any) => ({
      id: item.id,
      description: item.description || item.id,
      weightKg: item.weightKg ?? null,
      momentKgm: item.momentKgm ?? null,
      presentAtWeighing: !!item.presentAtWeighing,
      installed: !!configState[item.id]
    }));

    return res.json({ ok: true, variant: variantShort, rows });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err)
    });
  }
});


// =============================
// PRINT CONFIGURATION → PDF
// =============================
app.post("/config-items/:variant/print/pdf", async (req, res) => {
  console.log(">>> PRINT CONFIG PDF ROUTE HIT", req.params.variant);
  try {
    const variantShort = req.params.variant; // "10-01"

    const datasetPath = `datasets/atr_manta_${variantShort.replace("-", "_")}.json`;
    const statePath   = `state/manta_${variantShort.replace("-", "_")}.config.json`;

    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset not found: ${datasetPath}`);
    }
    if (!fs.existsSync(statePath)) {
      throw new Error(`Config state not found: ${statePath}`);
    }

    const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
    const state   = JSON.parse(fs.readFileSync(statePath, "utf-8"));

    const configItems = dataset.configItems ?? [];
    const configState = state.configState ?? {};

    const rows = configItems.map((item: any) => ({
      description: item.description || item.id,
      weightKg: item.weightKg ?? null,
      momentKgm: item.momentKgm ?? null,
      presentAtWeighing: !!item.presentAtWeighing,
      installed: !!configState[item.id]
    }));

    fs.mkdirSync("render", { recursive: true });
    const pdfPath = `configuration_${variantShort}.pdf`;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, left: 40, right: 40, bottom: 40 }
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // ===== TITLE =====
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(`CONFIGURATION ITEMS – MANTA ${variantShort}`, { align: "center" });

    doc.moveDown(1.2);

    // ===== TABLE LAYOUT =====
    const colX = [40, 260, 340, 420, 500];
    const rowH = 22;
    const headerH = 36;
    let y = doc.y;

    // ===== HEADER =====
    doc.fontSize(10).font("Helvetica-Bold");

    const headers = [
      "ITEMS DESCRIPTION",
      "WEIGHT (KG)",
      "MOMENT (kgm)",
      "PRESENT @ WEIGHING",
      "INSTALLED REMOVED"
    ];

    headers.forEach((h, i) => {
      doc.text(h, colX[i], y + 8, {
        width: colX[i + 1] ? colX[i + 1] - colX[i] - 4 : 80,
        align: "center"
      });
    });

    y += headerH;
    doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke();

    // ===== ROWS =====
    doc.font("Helvetica").fontSize(10);

    rows.forEach((r: any) => {
      if (y > 770) {
        doc.addPage();
        y = 40;
      }

      // description
      doc.fillColor("#000")
        .text(r.description, colX[0], y, { width: colX[1] - colX[0] - 4 });

      // weight
      doc.fillColor("#000")
        .text(r.weightKg != null ? Number(r.weightKg).toFixed(3) : "—", colX[1], y);

      // moment
      doc.fillColor("#000")
        .text(r.momentKgm != null ? Number(r.momentKgm).toFixed(3) : "—", colX[2], y);

      // PRESENT @ WEIGHING (blu / giallo)
      if (r.presentAtWeighing) {
        doc.rect(colX[3] - 2, y - 2, 80, rowH - 4).fillAndStroke("#dbeafe", "#1e3a8a");
        doc.fillColor("#1e3a8a").text("PRESENT", colX[3] + 4, y + 4);
      } else {
        doc.rect(colX[3] - 2, y - 2, 80, rowH - 4).fillAndStroke("#fef9c3", "#92400e");
        doc.fillColor("#92400e").text("NOT PRESENT", colX[3] + 4, y + 4);
      }

      // INSTALLED (verde / rosso)
      if (r.installed) {
        const wInstalled = 80;

doc.rect(colX[4] - 2, y - 2, wInstalled, rowH - 4)
  .fillAndStroke("#dcfce7", "#166534");

doc.fillColor("#166534")
  .text("INSTALLED", colX[4] - 2, y + 4, {
    width: wInstalled,
    align: "center"
  });
      } else {
        const wInstalled = 80;

doc.rect(colX[4] - 2, y - 2, wInstalled, rowH - 4)
  .fillAndStroke("#fee2e2", "#7f1d1d");

doc.fillColor("#7f1d1d")
  .text("REMOVED", colX[4] - 2, y + 4, {
    width: wInstalled,
    align: "center"
  });
      }

      y += rowH;
      doc.fillColor("#000");
    });

    doc.end();

    stream.on("finish", () => {
      return res.json({ ok: true, pdfUrl: `/render/${pdfPath}` });
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? String(err)
    });
  }
});

// =============================
// API: computeWB + render PNG
// =============================
app.post("/compute", async (req, res) => {
  try {
    const uiInput = req.body ?? {};
    const variant = String(uiInput.variant ?? "10-01");

    const mod: any = await loadScenarioModule(variant);
    const scenario = pickScenarioFromModule(mod, variant);

    if (!scenario?.input || !scenario?.datasetPath) {
      throw new Error("Scenario module missing input/datasetPath.");
    }

    const dataset = JSON.parse(fs.readFileSync(scenario.datasetPath, "utf-8"));
        // =============================
    // LOAD PERSISTENT CONFIG STATE (from /config-items Apply)
    // =============================
    const statePath = `state/manta_${variant.replace("-", "_")}.config.json`;
    let persistedConfigState: Record<string, boolean> = {};

    try {
      if (fs.existsSync(statePath)) {
        const stateFile = JSON.parse(fs.readFileSync(statePath, "utf-8"));
        persistedConfigState = stateFile?.configState ?? {};
      }
    } catch {
      persistedConfigState = {};
    }


    // ✅ MERGE CORRETTO: scenario standard + override UI
    const mergedInput: any = {
      ...scenario.input,
      ...uiInput,

      cargoKg: {
        ...(scenario.input.cargoKg ?? {}),
        ...(uiInput.cargoKg ?? {})
      },

      cargoStationsKg: {
        ...(scenario.input.cargoStationsKg ?? {}),
        ...(uiInput.cargoStationsKg ?? {})
      },

      basicIndexCorrection: {
        ...(scenario.input.basicIndexCorrection ?? {}),
        ...(uiInput.basicIndexCorrection ?? {})
      },

      cabinCrewOccupants: {
        ...(scenario.input.cabinCrewOccupants ?? {}),
        ...(uiInput.cabinCrewOccupants ?? {})
      },

      svInstalled: {
        ...(scenario.input.svInstalled ?? {}),
        ...(uiInput.svInstalled ?? {})
      },

      svQty: {
        ...(scenario.input.svQty ?? {}),
        ...(uiInput.svQty ?? {})
      },

            configState: {
        ...(scenario.input.configState ?? {}),
        ...(persistedConfigState ?? {}),
        ...(uiInput.configState ?? {})
      }

    };

    const validation = validateInput(dataset, mergedInput);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, errors: validation.errors });
    }

    const result = computeWB(dataset, mergedInput);
    console.log("=== DEBUG /compute INPUT SNAPSHOT ===");
console.log("variant:", variant);
console.log("cargoKg:", mergedInput.cargoKg);
console.log("crewBaggageKg:", mergedInput.crewBaggageKg);
console.log("takeoffFuelKg:", mergedInput.takeoffFuelKg, "tripFuelKg:", mergedInput.tripFuelKg);

const cargoStationsTotal = Object.values(mergedInput.cargoStationsKg ?? {}).reduce(
  (a: number, v: any) => a + Number(v || 0),
  0
);
console.log("cargoStationsTotal:", cargoStationsTotal);

console.log("=== DEBUG /compute RESULT WEIGHTS ===");
console.log({
  zeroFuelWeight: result.zeroFuelWeight,
  takeoffWeight: result.takeoffWeight,
  landingWeight: result.landingWeight
});

    // (opzionale) salva runtime per debug
    fs.mkdirSync("state", { recursive: true });
    fs.writeFileSync(
      "state/ui_input.runtime.json",
      JSON.stringify(req.body ?? {}, null, 2)
    );
fs.mkdirSync("state", { recursive: true });

    fs.writeFileSync(
      "state/pdf_input.runtime.json",
      JSON.stringify(req.body ?? {}, null, 2)
    );
    // ✅ Render UNA SOLA VOLTA (usa lo script congelato)
    const r = spawnSync(
      "npx",
      ["ts-node", "tools/render_test_page.ts", variant],
      { stdio: "inherit" }
    );

    // 🔴 PULIZIA OBBLIGATORIA
try {
  fs.unlinkSync("state/ui_input.runtime.json");
} catch {}

    if (r.status !== 0) {
      throw new Error("Render failed (tools/render_test_page.ts).");
    }

    return res.json({
      ok: true,
      result,
      renderUrl: "/render/wb_filled_test.png"
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// =============================
// API: export PDF (flight info only)
// =============================
app.post("/export/pdf", async (req, res) => {
  try {
    let cargoPngPath: string | null = null;
    const variant = String(req.body?.variant ?? "10-01");
    const flightInfo = req.body?.flightInfo ?? {};
    const uiDelta = req.body?.uiDelta ??{};
    const cargoStationsKg = uiDelta.cargoStationsKg ?? {};
const hasCargoStations =
  Object.values(cargoStationsKg).some(v => Number(v) > 0);

  const cargoTestPng = "render/cargo_layout_test.png";

// 🔴 se NON ci sono cargo stations → elimina PNG vecchio
if (!hasCargoStations) {
  if (fs.existsSync(cargoTestPng)) {
    fs.unlinkSync(cargoTestPng);
  }
  cargoPngPath = null;
} else {
  // genera PNG cargo aggiornato
  const r2 = spawnSync(
    "npx",
    ["ts-node", "tools/render_test_page.ts", variant, "--cargo-layout-test"],
    { stdio: "inherit" }
  );

  if (r2.status === 0 && fs.existsSync(cargoTestPng)) {
    cargoPngPath = cargoTestPng;
  } else {
    cargoPngPath = null;
    console.warn("⚠️ Cargo layout PNG not generated");
  }
}

  

        const scenarioMod: any = await loadScenario(variant);
    const scenario =
      scenarioMod[`scenarioManta${variant.replace("-", "")}`] ??
      scenarioMod.scenario ??
      scenarioMod.default;

    if (!scenario?.datasetPath || !scenario?.input) {
      throw new Error("Scenario not found for PDF export");
    }

    const dataset = JSON.parse(
      fs.readFileSync(scenario.datasetPath, "utf-8")
    );

        const mergedInput = {
      ...scenario.input,
      ...uiDelta
    };

    fs.mkdirSync("state", { recursive: true });

    // salva flight info runtime (separato dal compute)
    fs.writeFileSync(
      "state/flight_info.runtime.json",
      JSON.stringify(flightInfo, null, 2)
    );

        

    fs.writeFileSync(
      "state/flight_info.runtime.json",
      JSON.stringify(flightInfo, null, 2)
    );
// 🔴 pulizia render/: deve esistere UN SOLO PDF
const renderDir = "render";
if (fs.existsSync(renderDir)) {
  for (const f of fs.readdirSync(renderDir)) {
    if (f.toLowerCase().endsWith(".pdf")) {
      fs.unlinkSync(path.join(renderDir, f));
    }
  }
}
    // genera PDF con flight info
   const r = spawnSync(
  "npx",
  ["ts-node", "tools/export_pdf_from_png.ts", variant],
  { encoding: "utf-8" }
);

if (r.status !== 0) {
  throw new Error("Render PDF failed (export_pdf_from_png.ts)");
}
const stdout = r.stdout ?? "";
const match = stdout.match(/PDF_PATH::(.+)/);

if (!match) {
  throw new Error("PDF path not found in export output");
}

const pdfPath = match[1].trim();        // es: render/W&B MANTA 10-01 LICC-LIMJ 2026-02-09.pdf
const pdfUrl = "/" + pdfPath.replace(/\\/g, "/");

    if (r.status !== 0) {
      throw new Error("Render PDF failed (render_test_page.ts)");
    }

    return res.json({
      ok: true,
      pdfUrl
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// =============================
// START
// =============================
app.listen(number(PORT), "0.0.0.0.", () => {
  console.log(`✅ W&B bridge running on port ${PORT}`);
});