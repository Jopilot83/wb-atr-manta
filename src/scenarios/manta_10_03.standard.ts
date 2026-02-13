export const scenarioManta1003 = {
  variant: "MANTA_10_03",
  datasetPath: "datasets/atr_manta_10_03.json",

  input: {
        aircraftRegistration: "MM 62270",
    // ==================================================
    // MINIMUM CREW (NON persistente)
    // ==================================================
    minimumCrew: {
      CM1: { weightKg: 90, momentKgm: 408.6 },
      CM2: { weightKg: 90, momentKgm: 408.6 },
      OBSERVER_1: { weightKg: 90, momentKgm: 1289.7 }
    },

    // ==================================================
    // SV (scenario standard)
    // ==================================================
    svQty: {
      AERAZUR_FWD: 1,
      AERAZUR_AFT: 1,
      SAR_LIFE_RAFT: 5,
      SMOKE_MK6: 3,
      SMOKE_MK7: 3
    },

    svInstalled: {
      SAJE80_CM1: true,
      SAJE80_CM2: true,
      SAJE80_CM3: false,
      SAJE80_OB1: true,
      SAJE80_OB2: true,
      SAJE80_OB3: false,
      SAJE80_TEV1: true,
      SAJE80_TEV2: true,
      SAJE80_TEV3: false
    },

    //==========================================
    // CARGO DOW
    //==========================================

    cargoStationsKg: {
    "CARGO_7_5": 0,
    "CARGO_8": 0,
    "CARGO_8_5": 0,
    "CARGO_9": 0,
    "CARGO_9_5": 0,
    "CARGO_10": 0,
    "CARGO_10_5": 0,
    "CARGO_11": 0,
    "CARGO_11_5": 0,
    "CARGO_12": 0,
    "CARGO_12_5": 0,
    "CARGO_13": 0,
    "CARGO_13_5": 0,
    "CARGO_14": 0,
    "CARGO_14_5": 0,
    "CARGO_15": 0,
    "CARGO_15_5": 0,
    "CARGO_16": 0,
    "CARGO_16_5": 0
},

    // ==================================================
    // MISSION OPTIONS
    // ==================================================
    cm3Installed: false,
    crewBaggageKg: 15,

    // ==================================================
    // LT BASE
    // ==================================================
    removeObserverForLT: true,

    // ==================================================
    // BASIC INDEX CORRECTION (manual – post LT BASE)
    // ==================================================
    basicIndexCorrection: {
      D: 0,
      E: 0,
      F: 0,
      G: 0
    },
    
    // ==================================================
    // MISSION CREW
    // ==================================================
    cabinCrewOccupants: {
      OPERATOR_1: 1,
      OPERATOR_2: 1,
      OBSERVER_1: 1,
      OBSERVER_2: 1,
      DEBRIEF_ROW1: 0,
      DEBRIEF_ROW2: 0,
      REST_ROW1: 0,
      REST_ROW2: 0
    },

    // ==================================================
    // CARGO
    // ==================================================
    cargoKg: {
      LH_FW: 15,
      RH_FW: 25,
      AFT: 83,
      BALLAST: 156
    },

    // ==================================================
    // FUEL (volatile → reset ogni run)
    // ==================================================
    takeoffFuelKg: 4200,
    tripFuelKg: 3600
  }
};