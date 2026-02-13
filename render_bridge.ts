import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

import { computeWB } from "./src/engine.ts";

// ⚠️ usa la tua pagina base
const BASE_IMAGE = "./ui/assets/wb_page-1.png"; // o wb_page-2e3.png
const RENDER_DIR = path.join(process.cwd(), "render");

export async function renderWB(
  dataset: any,
  input: any,
  result: any
): Promise<string> {

  const baseImg = await loadImage(BASE_IMAGE);
  const canvas = createCanvas(baseImg.width, baseImg.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(baseImg, 0, 0);

  // =============================
  // ESEMPIO: scrittura dati (poi li completiamo)
  // =============================
  ctx.font = "42px Helvetica";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(
    Math.ceil(result.takeoffWeight).toString(),
    3680,
    1335
  );

  // =============================
  // SAVE FILE
  // =============================
  const filename = `wb_${input.variant}.png`;
  const outPath = path.join(RENDER_DIR, filename);

  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));

  return `/render/${filename}`;
}