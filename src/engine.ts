import type { WeightWarning } from "./types.ts";

// ============================================================
// INDEX COMPUTATION (moment -> index) SOLO FINO A LT BASE
// ============================================================
function computeIndex(weightKg: number, momentKgm: number): number {
  if (weightKg === 0) return 0;
  const arm = momentKgm / weightKg;
  return ((((arm - 11.425) / 2.285) * 100 - 25) * weightKg) * 0.2285 / 1000;
}

// ============================================================
// ΔINDEX MODELS (post LT base)
// ============================================================
function applyFwdCargoDeltaIndex(baseIndex: number, fwdKg: number): number {
  // FWD cargo segno NEGATIVO (come mi hai corretto tu)
  return baseIndex - (fwdKg / 50) * 2.65;
}
function applyAftCargoDeltaIndex(baseIndex: number, aftKg: number): number {
  return baseIndex + (aftKg / 50) * 3.8;
}
function applyFuelDeltaIndex(baseIndex: number, fuelKg: number): number {
  return baseIndex + (fuelKg / 1000) * 1.77;
}

// =========================================================
// Trim di decollo
// =========================================================
export function indexToTrim(index: number, weightKg: number): number {
  if (weightKg <= 0) return 0;

  // ----------------------------
  // 1️⃣ INDEX → %MAC
  // ----------------------------
  const percentMAC =
    (index * 1000) / (weightKg * 0.2285) + 25;

  // ----------------------------
  // 2️⃣ %MAC → TRIM
  // ----------------------------
  const trim =
    -4.5 + ((percentMAC - 15) / 19) * 6;

  return trim;
}

export function computeWB(dataset: any, input: any) {

  // ==========================================================
  // PHASE 1 — MOMENT-BASED (WEIGHED -> DOW -> LT BASE)
  // ==========================================================
  let weight = Number(dataset.weighedWeight.weightKg) || 0;
  let moment = Number(dataset.weighedWeight.momentKgm) || 0;

  const breakdown: any[] = [];
  breakdown.push({ label: "WEIGHED WEIGHT", weightKg: weight, momentKgm: moment });

  const weighedWeight = weight;
  const weighedMoment = moment;
  const weighedIndex = computeIndex(weighedWeight, weighedMoment);

  // ==========================================================
  // MINIMUM CREW (FROM SCENARIO, NOT DATASET)
  // ==========================================================
  const minimumCrew = input.minimumCrew ?? {};

  for (const [id, crew] of Object.entries(minimumCrew)) {
    const w = Number((crew as any).weightKg) || 0;
    const m = Number((crew as any).momentKgm) || 0;

    if (w === 0 && m === 0) continue;

    weight += w;
    moment += m;

    breakdown.push({
      label: `Minimum crew: ${id}`,
      weightKg: w,
      momentKgm: m
    });
  }

  // ----------------------------
  // CONFIGURATION (AIRCRAFT STATE ONLY)
  // ----------------------------
  for (const item of dataset.configItems ?? []) {
    const installedNow =
      input.configState?.[item.id] ?? item.presentAtWeighing;

    let deltaW = 0;
    let deltaM = 0;

    if (item.presentAtWeighing && !installedNow) {
      deltaW = -item.weightKg;
      deltaM = -item.momentKgm;
    }

    if (!item.presentAtWeighing && installedNow) {
      deltaW = item.weightKg;
      deltaM = item.momentKgm;
    }

    if (deltaW !== 0 || deltaM !== 0) {
      weight += deltaW;
      moment += deltaM;

      breakdown.push({
        label: `Config: ${item.description}`,
        weightKg: deltaW,
        momentKgm: deltaM
      });
    }
  }

  const correctedWeight = weight;
  const correctedMoment = moment;
  const correctedIndex = computeIndex(correctedWeight, correctedMoment);

  // ---- SV ----
  for (const sv of dataset.svCatalog ?? []) {
    if (typeof sv?.code !== "string") continue;

    if (sv.code.startsWith("SAJE80_")) {
      const installed = input.svInstalled?.[sv.code] === true;
      if (!installed) continue;

      const w = Number(sv.unitWeightKg) || 0;
      const m = w * (Number(sv.arm) || 0);

      weight += w;
      moment += m;
      breakdown.push({ label: `SV: ${sv.code}`, weightKg: w, momentKgm: m });
      continue;
    }

    const qty = Number(input.svQty?.[sv.code] ?? 0);
    if (qty <= 0) continue;

    const w = qty * (Number(sv.unitWeightKg) || 0);
    const m = w * (Number(sv.arm) || 0);

    weight += w;
    moment += m;
    breakdown.push({ label: `SV: ${sv.code} x${qty}`, weightKg: w, momentKgm: m });
  }

  // ---- CM3 ----
  if (input.cm3Installed === true) {
    weight += 90.0;
    moment += 495.0;
    breakdown.push({ label: "CM3", weightKg: 90.0, momentKgm: 495.0 });
  }

  // ---- Crew baggage ----
  const crewBaggageKg = Number(input.crewBaggageKg ?? 0);
  if (crewBaggageKg > 0) {
    const m = crewBaggageKg * 10.333;
    weight += crewBaggageKg;
    moment += m;
    breakdown.push({ label: "Crew baggage", weightKg: crewBaggageKg, momentKgm: m });
  }

  // ---- CARGO DOW ----
  for (const station of dataset.cargoStations ?? []) {
    const w = Number(input.cargoStationsKg?.[station.id] ?? 0);
    if (w <= 0) continue;

    const m = w * (Number(station.arm) || 0);
    weight += w;
    moment += m;
    breakdown.push({ label: `Cargo ${station.id}`, weightKg: w, momentKgm: m });
  }

  const dowWeight = weight;
  const dowMoment = moment;
  const dowIndex = computeIndex(dowWeight, dowMoment);

  // ==========================================================
  // LT BASE = DOW - OBSERVER_1 (FROM MINIMUM CREW)
  // ==========================================================
  let ltBaseWeight = dowWeight;
  let ltBaseMoment = dowMoment;

  if (input.removeObserverForLT === true && minimumCrew.OBSERVER_1) {
    ltBaseWeight -= minimumCrew.OBSERVER_1.weightKg;
    ltBaseMoment -= minimumCrew.OBSERVER_1.momentKgm;
  }

  const ltBaseIndex = computeIndex(ltBaseWeight, ltBaseMoment);

  // ==========================================================
  // BASIC INDEX CORRECTION (post LT BASE, manual input)
  // ==========================================================
  const basicCorr = input.basicIndexCorrection ?? {};

  let correctedDryWeight = ltBaseWeight;
  let correctedDryIndex  = ltBaseIndex;

  function applyZone(zoneKg: number, coeffPer10kg: number) {
    if (!zoneKg || zoneKg === 0) return;
    const steps = zoneKg / 10;
    correctedDryWeight += zoneKg;
    correctedDryIndex  += steps * coeffPer10kg;
  }

  applyZone(Number(basicCorr.D ?? 0), -0.67);
  applyZone(Number(basicCorr.E ?? 0), +0.52);
  applyZone(Number(basicCorr.F ?? 0), +0.69);
  applyZone(Number(basicCorr.G ?? 0), -0.32);

  // ============================
  // PHASE 2 — INDEX DELTAS
  // ============================
  let zfwWeight = correctedDryWeight;
  let zfwIndex  = correctedDryIndex;

  for (const s of dataset.cabinCrewStations ?? []) {
    const n = Number(input.cabinCrewOccupants?.[s.id] ?? 0);
    if (n <= 0) continue;

    const nUsed = Math.min(n, Number(s.maxPersons ?? n));
    zfwWeight += nUsed * (Number(s.unitWeightKg ?? dataset.standardPersonKg ?? 90));
    zfwIndex  += nUsed * (Number(s.deltaIndexPerPerson) || 0);
  }

  const lh = Number(input.cargoKg?.LH_FW ?? 0);
  const rh = Number(input.cargoKg?.RH_FW ?? 0);
  const aft = Number(input.cargoKg?.AFT ?? 0);
  const ballast = Number(input.cargoKg?.BALLAST ?? 0);

  zfwWeight += lh + rh + aft + ballast;
  zfwIndex = applyFwdCargoDeltaIndex(zfwIndex, lh + rh);
  zfwIndex = applyAftCargoDeltaIndex(zfwIndex, aft + ballast);

  const zeroFuelWeight = zfwWeight;
  const zeroFuelIndex = zfwIndex;

  const takeoffFuelKg = Number(input.takeoffFuelKg ?? 0);
  const takeoffWeight = zeroFuelWeight + takeoffFuelKg;
  const takeoffIndex = applyFuelDeltaIndex(zeroFuelIndex, takeoffFuelKg);
  const takeoffTrim = indexToTrim(takeoffIndex, takeoffWeight);

  const tripFuelKg = Number(input.tripFuelKg ?? 0);
  const landingWeight = takeoffWeight - tripFuelKg;
  const landingIndex = takeoffIndex - (tripFuelKg / 1000) * 1.77;

 const weightWarnings = checkWeightLimits(dataset, {
  takeoffWeight,
  landingWeight,
  zeroFuelWeight
});

  // ==========================================================
  // RETURN (engine puro, envelope solo pass-through)
  // ==========================================================
  return {
    weighedWeight,
    weighedMoment,
    weighedIndex,

    correctedWeight,
    correctedMoment,
    correctedIndex,

    dowWeight,
    dowMoment,
    dowIndex,

    loadTrimBaseWeight: ltBaseWeight,
    loadTrimBaseMoment: ltBaseMoment,
    loadTrimBaseIndex: ltBaseIndex,

    correctedDryOperatingWeight: correctedDryWeight,
    correctedDryOperatingIndex: correctedDryIndex,

    zeroFuelWeight,
    zeroFuelIndex,

    takeoffWeight,
    takeoffIndex,
    takeoffTrim,

    landingWeight,
    landingIndex,

    envelope: dataset.envelope,

    warnings: {
      weight: weightWarnings
    },

    breakdown
  };
}

function checkWeightLimits(
  dataset: any,
  w: {
    takeoffWeight: number;
    landingWeight: number;
    zeroFuelWeight: number;
  }
): WeightWarning[] {

  const warnings: WeightWarning[] = [];
  const L = dataset.limits ?? {};

  const tow = Number(w.takeoffWeight);
  const lw  = Number(w.landingWeight);
  const zfw = Number(w.zeroFuelWeight);

  // WARNING — non bloccanti
  if (tow > L.maxTakeoffWeightKg) {
    warnings.push({
      code: "MAX_TAKEOFF_WEIGHT",
      level: "WARNING",
      actualKg: tow,
      limitKg: L.maxTakeoffWeightKg
    });
  }

  if (lw > L.maxLandingWeightKg) {
    warnings.push({
      code: "MAX_LANDING_WEIGHT",
      level: "WARNING",
      actualKg: lw,
      limitKg: L.maxLandingWeightKg
    });
  }

  if (lw < L.minFlightWeightKg) {
    warnings.push({
      code: "MIN_FLIGHT_WEIGHT",
      level: "WARNING",
      actualKg: lw,
      limitKg: L.minFlightWeightKg
    });
  }

  if (zfw > L.maxZeroFuelWeightKg) {
    warnings.push({
      code: "MAX_ZERO_FUEL_WEIGHT",
      level: "WARNING",
      actualKg: zfw,
      limitKg: L.maxZeroFuelWeightKg
    });
  }

  return warnings;
}
