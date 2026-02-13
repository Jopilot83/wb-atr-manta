export type Kg = number;
export type Index = number;

export type CabinCrewOccupants = Record<string, number>;

// ============================================================
// BASIC TYPES
// ============================================================

/** One point of the CG envelope in (weight, index) space */
export interface EnvelopePoint {
  weightKg: Kg;
  index: Index;
}

/** Cargo area definition */
export interface CargoAreaDef {
  name: "LH_FW" | "RH_FW" | "AFT";
  maxKg: Kg;
  armMm?: number;
  indexPerKg?: number;
}

/** Emergency equipment item */
export interface EmergencyItemDef {
  code: string;
  description: string;
  unitWeightKg: Kg;
  arm: number;
  indexPerUnit?: Index;
  maxQty?: number;
}

// ============================================================
// DATASET (IMMUTABLE, CERTIFIED)
// ============================================================

export interface VariantDataset {
  aircraft: "ATR42";
  variant: "MANTA_10_01" | "MANTA_10_02" | "MANTA_10_03";

  weighedWeight: {
    weightKg: Kg;
    momentKgm: number;
  };

  standardPersonKg: Kg;

  indexModel?: {
    cargo: {
      fwd: { kgStep: Kg; deltaIndex: Index };
      aft: { kgStep: Kg; deltaIndex: Index };
    };
    fuel: { kgStep: Kg; deltaIndex: Index };
  };

  cabinCrewStations?: Array<{
    id: string;
    label: string;
    maxPersons: number;
    deltaIndexPerPerson: Index;
    unitWeightKg?: Kg;
  }>;

  cargoAreas?: Record<CargoAreaDef["name"], CargoAreaDef>;
  emergencyEquipment?: EmergencyItemDef[];
  envelope?: EnvelopePoint[];

  trim?: Record<string, unknown>;
}

// ============================================================
// SCENARIO INPUT (BASELINE DI MISSIONE)
// ============================================================

export interface BasicIndexCorrection {
  D?: Kg;
  E?: Kg;
  F?: Kg;
  G?: Kg;
}

export interface ScenarioInput {
  minimumCrew?: Record<string, { weightKg: Kg; momentKgm: number }>;

  configState?: Record<string, boolean>;

  svQty?: Record<string, number>;
  svInstalled?: Record<string, boolean>;

  cm3Installed?: boolean;
  crewBaggageKg?: Kg;

  /** Always true by design – observer removed then re-added */
  removeObserverForLT?: true;

  cabinCrewOccupants?: CabinCrewOccupants;

  cargoKg?: {
    LH_FW?: Kg;
    RH_FW?: Kg;
    AFT?: Kg;
    BALLAST?: Kg;
  };

  takeoffFuelKg?: Kg;
  tripFuelKg?: Kg;

  /** Manual basic index correction (zones D/E/F/G, signed) */
  basicIndexCorrection?: BasicIndexCorrection;
}

// ============================================================
// USER-EDITABLE INPUTS (UI / CLI)
// ============================================================

/**
 * Subset of ScenarioInput that the user is allowed to modify.
 * Structural limits and dataset values are NOT editable.
 */
export interface UserEditableInput {
  /** Manual basic index correction (zones D/E/F/G, signed kg) */
  basicIndexCorrection?: BasicIndexCorrection;

  /** Cargo loaded on physical DOW stations (e.g. CARGO_12_5, CARGO_14) */
  cargoStationsKg?: Record<string, Kg>;

  /** Index-based cargo (forward / aft / ballast) */
  cargoKg?: {
    LH_FW?: Kg;
    RH_FW?: Kg;
    AFT?: Kg;
    BALLAST?: Kg;
  };

  /** Mission crew / passengers by station */
  cabinCrewOccupants?: CabinCrewOccupants;

  /** Crew baggage */
  crewBaggageKg?: Kg;

  /** Fuel */
  takeoffFuelKg?: Kg;
  tripFuelKg?: Kg;
};

//======================
//ENVELOPE
//========================

export type EnvelopeCondition =
  | "TAKEOFF"
  | "LANDING"
  | "ZERO_FUEL";

export interface EnvelopeCheck {
  condition: EnvelopeCondition;
  weightKg: Kg;
  index: Index;
  inside: boolean;
  margin?: number;
};

// ============================================================
// ENGINE OUTPUT (AS IS, TESTED)
// ============================================================

export type WeightWarningLevel = "INFO" | "CAUTION" | "WARNING" | "ERROR";

export interface WeightWarning {
  code: string;
  level: WeightWarningLevel;
  message: string;
  actualKg: number;
  limitKg?: number;
}

export interface EngineBreakdownLine {
  label: string;
  weightKg: Kg;
  momentKgm?: number | null;
  deltaIndex?: Index;
}

export interface EngineResult {
  weighedWeight: Kg;
  weighedMoment: number;
  weighedIndex: Index;

  correctedWeight: Kg;
  correctedMoment: number;
  correctedIndex: Index;

  dowWeight: Kg;
  dowMoment: number;
  dowIndex: Index;

  loadTrimBaseWeight: Kg;
  loadTrimBaseMoment: number;
  loadTrimBaseIndex: Index;

  zeroFuelWeight: Kg;
  zeroFuelIndex: Index;

  takeoffWeight: Kg;
  takeoffIndex: Index;
  takeoffTrim?: number;

  landingWeight: Kg;
  landingIndex: Index;

  envelope?: {
    takeoff: EnvelopeCheck;
    landing: EnvelopeCheck;
    zeroFuel: EnvelopeCheck;
  };

  warnings: {
    weight: WeightWarning[];
  };

  breakdown: EngineBreakdownLine[];
}