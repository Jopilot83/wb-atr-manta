// tools/dumpScenario.ts
import fs from "fs";
import path from "path";

import { computeWB } from "../src/engine.ts";
import { scenarioManta1002 } from "../src/scenarios/manta_10_02.standard.ts";

const datasetPath = path.resolve(
  process.cwd(),
  scenarioManta1002.datasetPath
);

const dataset = JSON.parse(
  fs.readFileSync(datasetPath, "utf-8")
);

const result = computeWB(dataset, scenarioManta1002.input);

fs.writeFileSync(
  "tests/fixtures/manta_10_02.expected.json",
  JSON.stringify(result, null, 2)
);

console.log("✅ Golden output MANTA 10-02 scritto");