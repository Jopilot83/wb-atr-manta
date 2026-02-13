import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { computeWB } from "../src/engine.ts";
import { scenarioManta1003 } from "../src/scenarios/manta_10_03.standard.ts";

describe("MANTA 10-03 – regression test", () => {
  it("matches frozen numerical output", () => {
    // =========================
    // LOAD DATASET
    // =========================
    const datasetPath = path.resolve(
      process.cwd(),
      scenarioManta1003.datasetPath
    );

    const dataset = JSON.parse(
      fs.readFileSync(datasetPath, "utf-8")
    );

    // =========================
    // LOAD EXPECTED (GOLDEN)
    // =========================
    const expected = JSON.parse(
      fs.readFileSync(
        "tests/fixtures/manta_10_03.expected.json",
        "utf-8"
      )
    );

    // =========================
    // RUN ENGINE
    // =========================
    const result = computeWB(dataset, scenarioManta1003.input);

    // =========================
    // ASSERT
    // =========================
    expect(result).toEqual(expected);
  });
});