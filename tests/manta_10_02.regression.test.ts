import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

import { computeWB } from "../src/engine.ts";
import { scenarioManta1002 } from "../src/scenarios/manta_10_02.standard.ts";

describe("MANTA 10-02 – regression test", () => {
  it("matches frozen numerical output", () => {
    // =========================
    // LOAD DATASET
    // =========================
    const datasetPath = path.resolve(
      process.cwd(),
      scenarioManta1002.datasetPath
    );

    const dataset = JSON.parse(
      fs.readFileSync(datasetPath, "utf-8")
    );

    // =========================
    // LOAD EXPECTED (GOLDEN)
    // =========================
    const expected = JSON.parse(
      fs.readFileSync(
        "tests/fixtures/manta_10_02.expected.json",
        "utf-8"
      )
    );

    // =========================
    // RUN ENGINE
    // =========================
    const result = computeWB(dataset, scenarioManta1002.input);

    // =========================
    // ASSERT
    // =========================
    expect(result).toEqual(expected);
  });
});