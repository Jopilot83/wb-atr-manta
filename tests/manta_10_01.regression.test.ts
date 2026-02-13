import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { computeWB } from "../src/engine.ts";
import { scenarioManta1001 } from "../src/scenarios/manta_10_01.standard.ts";

describe("MANTA 10-01 – regression test", () => {
  it("matches frozen numerical output", () => {
    // =========================
    // LOAD DATASET
    // =========================
    const datasetPath = path.resolve(
      process.cwd(),
      scenarioManta1001.datasetPath
    );

    const dataset = JSON.parse(
      fs.readFileSync(datasetPath, "utf-8")
    );

    // =========================
    // LOAD EXPECTED (GOLDEN)
    // =========================
    const expected = JSON.parse(
      fs.readFileSync(
        "tests/fixtures/manta_10_01.expected.json",
        "utf-8"
      )
    );

    // =========================
    // RUN ENGINE
    // =========================
    const result = computeWB(dataset, scenarioManta1001.input);

    // =========================
    // ASSERT
    // =========================
    expect(result).toEqual(expected);
  });
});