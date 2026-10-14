import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

const ROOT = process.cwd();

const imagePath = path.join(
  ROOT,
  "test-images",
  "skin-test.jpg"
);

const outputPath = path.join(
  ROOT,
  "test-images",
  "sharp-intermediate.jpg"
);

const orientedBuffer = await sharp(imagePath)
  .rotate()
  .toBuffer();

await fs.writeFile(outputPath, orientedBuffer);

console.log("Intermediate JPEG saved:", outputPath);
