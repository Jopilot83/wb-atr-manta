import fs from "fs";

import { scenarioManta1001 } from "./scenarios/manta_10_01.standard.ts";
import { scenarioManta1002 } from "./scenarios/manta_10_02.standard.ts";
import { scenarioManta1003 } from "./scenarios/manta_10_03.standard.ts";
import { runScenario } from "./runScenario.ts";

// ==================================================
// CLI ARGUMENTS
// ==================================================
const variant = process.argv[2];
const W = (kg: number) => Math.ceil(kg);

if (!variant) {
  console.error("❌ Missing aircraft variant.");
  console.error("Usage: npx ts-node src/index.ts <10-01|10-02|10-03>");
  process.exit(1);
}

let scenario: any;
let statePath: string;

switch (variant) {
  case "10-01":
    scenario = scenarioManta1001;
    statePath = "state/manta_10_01.config.json";
    break;

  case "10-02":
    scenario = scenarioManta1002;
    statePath = "state/manta_10_02.config.json";
    break;

  case "10-03":
    scenario = scenarioManta1003;
    statePath = "state/manta_10_03.config.json";
    break;

  default:
    console.error(`❌ Unknown variant "${variant}".`);
    console.error("Allowed values: 10-01 | 10-02 | 10-03");
    process.exit(1);
}

// ==================================================
// LOAD STATE / CONFIG
// ==================================================
const stateConfig = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf-8"))
  : {};

// ==================================================
// MERGE SCENARIO + STATE
// ==================================================
const mergedScenario = {
  ...scenario,
  input: {
    ...scenario.input,
    ...stateConfig
  }
};

// ==================================================
// RUN ENGINE
// ==================================================
let result: any;
try {
  result = runScenario(mergedScenario);
} catch (err: any) {
  console.error("❌ Calculation failed:");
  console.error(err?.message ?? err);
  process.exit(1);
}

// ==================================================
// OUTPUT
// ==================================================
console.log("");
console.log("====================================");
console.log(` AIRCRAFT: ${scenario.variant}`);
console.log("====================================");

// --------------------------------------------------
// OEW CORRECTED (config + minimum crew)
// --------------------------------------------------
console.log("\n--- OEW CORRECTED ---");
console.log(`Weight: ${W(result.correctedWeight)} kg`);
console.log(`Index : ${result.correctedIndex.toFixed(2)}`);

// ==============================
// CARGO (PHYSICAL STATIONS)
// ==============================
console.log("\n--- CARGO (Physical Stations) ---");

const dowCargoLines = (result.breakdown ?? []).filter((l: any) => {
  const isCargoLabel =
    typeof l?.label === "string" && l.label.startsWith("Cargo ");

  const isMomentBased =
    l?.momentKgm !== null && l?.momentKgm !== undefined;

  return isCargoLabel && isMomentBased;
});

let totalDowCargo = 0;

for (const line of dowCargoLines) {
  const station = String(line.label).replace("Cargo ", "");
  const w = Number(line.weightKg ?? 0);

  totalDowCargo += w;
  console.log(`${station.padEnd(12)}: ${W(w)} kg`);
}

if (dowCargoLines.length === 0) {
  console.log("No cargo loaded");
} else {
  console.log("-------------------------------");
  console.log(`TOTAL CARGO: ${W(totalDowCargo)} kg`);
}

// --------------------------------------------------
// DOW (Load & Trim Base – naming manuale)
// --------------------------------------------------
console.log("\n--- DOW (Load & Trim Sheet) ---");
console.log(`Weight: ${W(result.loadTrimBaseWeight)} kg`);
console.log(`Index : ${result.loadTrimBaseIndex.toFixed(2)}`);

// --------------------------------------------------
// SV EQUIPMENT
// --------------------------------------------------
console.log("\n--- DOTAZIONI SV ---");

const svQty = scenario.input.svQty ?? {};
const svInstalled = scenario.input.svInstalled ?? {};

for (const [code, qty] of Object.entries(svQty)) {
  if (qty > 0) console.log(`${code}: ${qty}`);
}

for (const [code, installed] of Object.entries(svInstalled)) {
  console.log(`${code}: ${installed ? "INSTALLED" : "NOT INSTALLED"}`);
}

// --------------------------------------------------
// FLIGHT CREW (minimum crew)
// --------------------------------------------------
console.log("\n--- MINIMUM CREW ---");

const minCrew = scenario.input.minimumCrew ?? {};
for (const [id, data] of Object.entries(minCrew)) {
  console.log(`${id}: ${W((data as any).weightKg)} kg`);
}

// --------------------------------------------------
// CREW BAGGAGE
// --------------------------------------------------
console.log("\n--- CREW BAGGAGE ---");
console.log(`${W(scenario.input.crewBaggageKg ?? 0)} kg`);

// --------------------------------------------------
// BASIC INDEX CORRECTION (by zone)
// --------------------------------------------------
const basicCorr = scenario.input.basicIndexCorrection ?? {};

type Zone = "D" | "E" | "F" | "G";

const zoneCoeff: Record<Zone, number> = {
  D: -0.67,
  E: +0.52,
  F: +0.69,
  G: -0.32
};

console.log("\n--- BASIC INDEX CORRECTION ---");

let totalDeviationKg = 0;
let totalDeltaIndex = 0;

for (const z of ["D", "E", "F", "G"] as Zone[]) {
  const kg = basicCorr[z] ?? 0;
  if (kg === 0) {
    console.log(`Zone ${z}: 0 kg → ΔIndex 0.00`);
    continue;
  }

  const deltaIndex = (kg / 10) * zoneCoeff[z];
  totalDeviationKg += kg;
  totalDeltaIndex += deltaIndex;

  console.log(
    `Zone ${z}: ${W(kg)} kg → ΔIndex ${deltaIndex.toFixed(2)}`
  );
}

console.log(
  `TOTAL: ${W(totalDeviationKg)} kg → ΔIndex ${totalDeltaIndex.toFixed(2)}`
);

// --------------------------------------------------
// CORRECTED DRY OPERATING CONDITION
// --------------------------------------------------
console.log("\n=== CORRECTED DRY OPERATING CONDITION ===");
console.log(`Weight: ${W(result.correctedDryOperatingWeight)} kg`);
console.log(`Index : ${result.correctedDryOperatingIndex.toFixed(2)}`);

// --------------------------------------------------
// TOTAL CARGO
// --------------------------------------------------
const cargo = scenario.input.cargoKg ?? {};
const totalCargo =
  (cargo.LH_FW ?? 0) +
  (cargo.RH_FW ?? 0) +
  (cargo.AFT ?? 0) +
  (cargo.BALLAST ?? 0);

console.log("\n--- TOTAL CARGO ---");
console.log(`FWD LH : ${W(cargo.LH_FW ?? 0)} kg`);
console.log(`FWD RH : ${W(cargo.RH_FW ?? 0)} kg`);
console.log(`AFT    : ${W(cargo.AFT ?? 0)} kg`);
console.log(`BALLAST: ${W(cargo.BALLAST ?? 0)} kg`);
console.log(`TOTAL  : ${W(totalCargo)} kg`);

// --------------------------------------------------
// CABIN MEMBERS
// --------------------------------------------------
const cabinCrew = scenario.input.cabinCrewOccupants ?? {};
const cabinCrewCount = Object.values(cabinCrew).reduce(
  (a: number, b: number) => a + b,
  0
);

console.log("\n--- TOTAL CABIN MEMBERS ---");
console.log(`Persons: ${cabinCrewCount}`);
console.log(`Weight : ${W(cabinCrewCount * 90)} kg`);

// --------------------------------------------------
// ZERO FUEL
// --------------------------------------------------
console.log("\n--- ACTUAL ZERO FUEL WEIGHT ---");
console.log(`Weight: ${W(result.zeroFuelWeight)} kg`);
console.log(`Index : ${result.zeroFuelIndex.toFixed(2)}`);

// --------------------------------------------------
// TAKEOFF
// --------------------------------------------------
console.log("\n--- TAKE OFF FUEL ---");
console.log(`${W(scenario.input.takeoffFuelKg)} kg`);

console.log("\n--- ACTUAL TAKE OFF CONDITION ---");
console.log(`Weight: ${W(result.takeoffWeight)} kg`);
console.log(`Index : ${result.takeoffIndex.toFixed(2)}`);
console.log(
  `Trim  : ${Math.abs(result.takeoffTrim).toFixed(2)} ${
    result.takeoffTrim < 0
      ? "Nose Up"
      : result.takeoffTrim > 0
      ? "Nose Down"
      : "Neutral"
  }`
);

// --------------------------------------------------
// LANDING
// --------------------------------------------------
console.log("\n--- TRIP FUEL ---");
console.log(`${W(scenario.input.tripFuelKg)} kg`);

console.log("\n--- ACTUAL LANDING CONDITION ---");
console.log(`Weight: ${W(result.landingWeight)} kg`);
console.log(`Index : ${result.landingIndex.toFixed(2)}`);

//===================================================
// ENVELOPE (GRAPHICAL DATA ONLY)
//===================================================
if (Array.isArray(result.envelope)) {
  console.log("\n=== ENVELOPE (STRUCTURAL / OPERATIONAL POLYGON) ===");

  result.envelope.forEach((p: any, i: number) => {
    console.log(
      `Point ${i + 1}: Weight ${W(p.weightKg)} kg | Index ${p.index.toFixed(2)}`
    );
  });
}

//===================================================
// WARNINGS (WEIGHT ONLY)
//===================================================
const weightWarnings = result.warnings?.weight ?? [];

if (weightWarnings.length > 0) {
  console.log("\n=== WARNINGS ===");

  for (const w of weightWarnings) {
    const icon =
      w.level === "ERROR"
        ? "❌"
        : w.level === "CAUTION"
        ? "⚠️"
        : "ℹ️";

    console.log(`${icon} [${w.level}] ${w.code}: ${w.message}`);

    if (w.limitKg !== undefined) {
      console.log(
        `    Actual: ${W(w.actualKg)} kg | Limit: ${W(w.limitKg)} kg`
      );
    } else {
      console.log(`    Actual: ${W(w.actualKg)} kg`);
    }
  }
}