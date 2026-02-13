import type {
  VariantDataset,
  UserEditableInput,
  BasicIndexCorrection
} from "../types.ts";

export interface InputValidationError {
  field: string;
  message: string;
}

export interface InputValidationResult {
  valid: boolean;
  errors: InputValidationError[];
}

export function validateInput(
  dataset: VariantDataset,
  input: UserEditableInput
): InputValidationResult {

  const errors: InputValidationError[] = [];

  // ==================================================
  // FUEL
  // ==================================================
  const takeoffFuel = input.takeoffFuelKg ?? 0;
  const tripFuel = input.tripFuelKg ?? 0;

  if (takeoffFuel < 0) {
    errors.push({
      field: "takeoffFuelKg",
      message: "Takeoff fuel cannot be negative"
    });
  }

  if (tripFuel < 0) {
    errors.push({
      field: "tripFuelKg",
      message: "Trip fuel cannot be negative"
    });
  }

  if (tripFuel > takeoffFuel) {
    errors.push({
      field: "tripFuelKg",
      message: "Trip fuel cannot exceed takeoff fuel"
    });
  }

  if (takeoffFuel > 4500) {
  errors.push({
    field: "takeoffFuelKg",
    message: "Takeoff fuel exceeds maximum allowed (4500 kg)"
  });
}

//=============================
// CARGO - MAX LIMITS
//=============================

const cargoKg = input.cargoKg ?? {};
const cargoLimits = dataset.cargoLimits ?? {};

const lh = Number(cargoKg.LH_FW ?? 0);
const rh = Number(cargoKg.RH_FW ?? 0);
const aft = Number(cargoKg.AFT ?? 0);
const ballast = Number(cargoKg.BALLAST ?? 0);

// LH FW
if (cargoLimits.LH_FW?.maxKg != null && lh > cargoLimits.LH_FW.maxKg) {
  errors.push({
    field: "cargoKg.LH_FW",
    message: `LH FW cargo exceeds maximum (${cargoLimits.LH_FW.maxKg} kg)`
  });
}

// RH FW
if (cargoLimits.RH_FW?.maxKg != null && rh > cargoLimits.RH_FW.maxKg) {
  errors.push({
    field: "cargoKg.RH_FW",
    message: `RH FW cargo exceeds maximum (${cargoLimits.RH_FW.maxKg} kg)`
  });
}

// AFT + BALLAST (contributo combinato)
const aftTotal = aft + ballast;
if (cargoLimits.AFT?.maxKg != null && aftTotal > cargoLimits.AFT.maxKg) {
  errors.push({
    field: "cargoKg.AFT",
    message: `AFT cargo (including ballast) exceeds maximum (${cargoLimits.AFT.maxKg} kg)`
  });
}

  // ==================================================
  // CARGO — INDEX BASED (LH_FW / RH_FW / AFT / BALLAST)
  // ==================================================
  for (const [area, kg] of Object.entries(input.cargoKg ?? {})) {
    if (kg < 0) {
      errors.push({
        field: `cargoKg.${area}`,
        message: "Cargo weight cannot be negative"
      });
    }
  }

  // ==================================================
  // CARGO — PHYSICAL DOW STATIONS
  // ==================================================
  for (const [stationId, kg] of Object.entries(input.cargoStationsKg ?? {})) {
    if (kg < 0) {
      errors.push({
        field: `cargoStationsKg.${stationId}`,
        message: "Cargo station weight cannot be negative"
      });
    }

    const exists = dataset.cargoStations?.some(s => s.id === stationId);
    if (!exists) {
      errors.push({
        field: `cargoStationsKg.${stationId}`,
        message: "Unknown cargo station"
      });
    }
  }

  // ==================================================
  // CABIN CREW / PAX
  // ==================================================
  for (const [id, n] of Object.entries(input.cabinCrewOccupants ?? {})) {
    if (!Number.isInteger(n) || n < 0) {
      errors.push({
        field: `cabinCrewOccupants.${id}`,
        message: "Occupants must be a non-negative integer"
      });
      continue;
    }

    const station = dataset.cabinCrewStations?.find(s => s.id === id);
    if (!station) {
      errors.push({
        field: `cabinCrewOccupants.${id}`,
        message: "Unknown cabin crew station"
      });
      continue;
    }

    if (n > station.maxPersons) {
      errors.push({
        field: `cabinCrewOccupants.${id}`,
        message: `Exceeds maximum allowed persons (${station.maxPersons})`
      });
    }
  }

  // ==================================================
  // BASIC INDEX CORRECTION (D / E / F / G)
  // ==================================================
  const corr: BasicIndexCorrection = input.basicIndexCorrection ?? {};

  for (const [zone, kg] of Object.entries(corr)) {
    if (kg % 10 !== 0) {
      errors.push({
        field: `basicIndexCorrection.${zone}`,
        message: "Basic index correction must be in multiples of 10 kg"
      });
    }
  }

  // ==================================================
  // SV EQUIPMENT
  // ==================================================
  for (const [code, qty] of Object.entries(input.svQty ?? {})) {
    if (!Number.isInteger(qty) || qty < 0) {
      errors.push({
        field: `svQty.${code}`,
        message: "SV quantity must be a non-negative integer"
      });
    }

    const exists = dataset.svCatalog?.some(sv => sv.code === code);
    if (!exists) {
      errors.push({
        field: `svQty.${code}`,
        message: "Unknown SV code"
      });
    }
  }

  for (const [code, installed] of Object.entries(input.svInstalled ?? {})) {
    if (typeof installed !== "boolean") {
      errors.push({
        field: `svInstalled.${code}`,
        message: "SV installed flag must be boolean"
      });
    }

    const exists = dataset.svCatalog?.some(sv => sv.code === code);
    if (!exists) {
      errors.push({
        field: `svInstalled.${code}`,
        message: "Unknown SV code"
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}