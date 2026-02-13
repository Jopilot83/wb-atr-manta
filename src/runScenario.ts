// src/runScenario.ts
import { computeWB } from "./engine.ts";
import { validateInput } from "./validation/validateInput.ts";
import fs from "fs";

export function runScenario(scenario: any) {
  const dataset = JSON.parse(
    fs.readFileSync(scenario.datasetPath, "utf-8")
  );

  // ==================================================
  // INPUT VALIDATION (logic & sanity checks)
  // ==================================================
  const validation = validateInput(dataset, scenario.input);

  if (!validation.valid) {
    const messages = validation.errors
      .map(e => `• ${e.field}: ${e.message}`)
      .join("\n");

    throw new Error(
      `Input validation failed:\n${messages}`
    );
  }

  return computeWB(dataset, scenario.input);
}