// tools/dumpScenario.ts
import fs from "fs";
import path from "path";

import { computeWB } from "../src/engine.ts";
import { scenarioManta1003 } from "../src/scenarios/manta_10_03.standard.ts";

const datasetPath = path.resolve(
  process.cwd(),
  scenarioManta1003.datasetPath
);

const dataset = JSON.parse(
  fs.readFileSync(datasetPath, "utf-8")
);

const result = computeWB(dataset, scenarioManta1003.input);

fs.writeFileSync(
  "tests/fixtures/manta_10_03.expected.json",
  JSON.stringify(result, null, 2)
);

console.log("✅ Golden output MANTA 10-03 scritto");