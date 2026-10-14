
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";

// ==========================================
// CONFIGURATION
// ==========================================

const ROOT = process.cwd();

const MODEL_PATH = path.join(
  ROOT,
  "model",
  "veritaderm.onnx"
);

const IMAGE_PATH = path.join(
  ROOT,
  "test-images",
  "skin-test.jpg"
);

const OUTPUT_DIR = path.join(ROOT, "test-results");

const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.10;
const IOU_THRESHOLD = 0.45;

const CLASS_NAMES = [
  "Acne",
  "Chicken Skin",
  "Eczema",
  "Leprosy",
  "Psoriasis",
  "Ringworm",
  "Warts",
  "Healthy",
];

// ==========================================
// 1. IMAGE PREPROCESSING
// ==========================================

async function preprocessImage(imagePath) {
  // Apply EXIF orientation before measuring
  const image = sharp(imagePath).rotate();

  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image dimensions");
  }

  // Normalize orientation into a buffer first
  const orientedBuffer = await sharp(imagePath)
    .rotate()
    .toBuffer();

  const orientedMetadata = await sharp(
    orientedBuffer
  ).metadata();

  const originalWidth = orientedMetadata.width;
  const originalHeight = orientedMetadata.height;

  // Preserve aspect ratio
  const scale = Math.min(
    INPUT_SIZE / originalWidth,
    INPUT_SIZE / originalHeight
  );

  const resizedWidth = Math.round(
    originalWidth * scale
  );

  const resizedHeight = Math.round(
    originalHeight * scale
  );

  const padLeft = Math.floor(
    (INPUT_SIZE - resizedWidth) / 2
  );

  const padTop = Math.floor(
    (INPUT_SIZE - resizedHeight) / 2
  );

  // Explicit letterboxing
  const resized = await sharp(orientedBuffer)
    .resize(resizedWidth, resizedHeight, {
      fit: "fill",
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();

  const { data, info } = await sharp(resized, {
    raw: {
      width: resizedWidth,
      height: resizedHeight,
      channels: 3,
    },
  })
    .extend({
      top: padTop,
      bottom: INPUT_SIZE - resizedHeight - padTop,
      left: padLeft,
      right: INPUT_SIZE - resizedWidth - padLeft,
      background: {
        r: 114,
        g: 114,
        b: 114,
      },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (
    info.width !== INPUT_SIZE ||
    info.height !== INPUT_SIZE ||
    info.channels !== 3
  ) {
    throw new Error("Invalid preprocessed image");
  }

  // HWC -> CHW, normalize 0-255 -> 0-1
  const channelSize = INPUT_SIZE * INPUT_SIZE;
  const tensorData = new Float32Array(
    3 * channelSize
  );

  for (let i = 0; i < channelSize; i++) {
    const pixelIndex = i * 3;

    tensorData[i] = data[pixelIndex] / 255;

    tensorData[channelSize + i] =
      data[pixelIndex + 1] / 255;

    tensorData[2 * channelSize + i] =
      data[pixelIndex + 2] / 255;
  }

  const tensor = new ort.Tensor(
    "float32",
    tensorData,
    [1, 3, INPUT_SIZE, INPUT_SIZE]
  );

  return {
    tensor,
    orientedBuffer,
    originalWidth,
    originalHeight,
    scale,
    padLeft,
    padTop,
  };
}

// ==========================================
// 2. IOU
// ==========================================

function calculateIoU(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);

  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  const intersection =
    Math.max(0, x2 - x1) *
    Math.max(0, y2 - y1);

  const areaA =
    Math.max(0, a.x2 - a.x1) *
    Math.max(0, a.y2 - a.y1);

  const areaB =
    Math.max(0, b.x2 - b.x1) *
    Math.max(0, b.y2 - b.y1);

  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

// ==========================================
// 3. NON-MAXIMUM SUPPRESSION
// ==========================================

function applyNMS(detections) {
  const sorted = [...detections].sort(
    (a, b) => b.confidence - a.confidence
  );

  const selected = [];

  while (sorted.length > 0) {
    const best = sorted.shift();

    selected.push(best);

    for (let i = sorted.length - 1; i >= 0; i--) {
      const candidate = sorted[i];

      if (candidate.classId !== best.classId) {
        continue;
      }

      if (
        calculateIoU(best, candidate) >
        IOU_THRESHOLD
      ) {
        sorted.splice(i, 1);
      }
    }
  }

  return selected;
}

// ==========================================
// 4. DECODE YOLO11 OUTPUT
// ==========================================

function decodeOutput(output, imageInfo) {
  const data = output.data;
  const dims = output.dims;

  console.log("Output shape:", dims);

  if (
    dims.length !== 3 ||
    dims[0] !== 1 ||
    dims[1] !== 4 + CLASS_NAMES.length
  ) {
    throw new Error(
      `Unexpected output shape: ${dims.join(", ")}`
    );
  }

  const numCandidates = dims[2];

  let highestConfidence = -Infinity;
  let bestClassIndex = -1;
  let bestCandidateIndex = -1;

  let aboveThresholdCount = 0;
  let invalidScores = 0;

  const detections = [];

  for (let i = 0; i < numCandidates; i++) {
    let bestScore = -Infinity;
    let bestClass = -1;

    for (let c = 0; c < CLASS_NAMES.length; c++) {
      const score =
        data[(4 + c) * numCandidates + i];

      if (!Number.isFinite(score)) {
        invalidScores++;
        continue;
      }

      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore > highestConfidence) {
      highestConfidence = bestScore;
      bestClassIndex = bestClass;
      bestCandidateIndex = i;
    }

    if (
      bestClass === -1 ||
      bestScore < CONFIDENCE_THRESHOLD
    ) {
      continue;
    }

    aboveThresholdCount++;

    const cx = data[i];
    const cy = data[numCandidates + i];
    const w = data[2 * numCandidates + i];
    const h = data[3 * numCandidates + i];

    if (
      ![cx, cy, w, h].every(Number.isFinite) ||
      w <= 0 ||
      h <= 0
    ) {
      continue;
    }

    // Undo letterboxing
    const x1 =
      (cx - w / 2 - imageInfo.padLeft) /
      imageInfo.scale;

    const y1 =
      (cy - h / 2 - imageInfo.padTop) /
      imageInfo.scale;

    const x2 =
      (cx + w / 2 - imageInfo.padLeft) /
      imageInfo.scale;

    const y2 =
      (cy + h / 2 - imageInfo.padTop) /
      imageInfo.scale;

    const box = {
      x1: Math.max(
        0,
        Math.min(imageInfo.originalWidth, x1)
      ),
      y1: Math.max(
        0,
        Math.min(imageInfo.originalHeight, y1)
      ),
      x2: Math.max(
        0,
        Math.min(imageInfo.originalWidth, x2)
      ),
      y2: Math.max(
        0,
        Math.min(imageInfo.originalHeight, y2)
      ),
    };

    if (
      box.x2 <= box.x1 ||
      box.y2 <= box.y1
    ) {
      continue;
    }

    detections.push({
      classId: bestClass,
      className: CLASS_NAMES[bestClass],
      confidence: bestScore,
      ...box,
    });
  }

  console.log("\n========== MODEL DEBUG ==========");

  console.log("Total Candidates:", numCandidates);

  console.log(
    "Highest Confidence:",
    Number.isFinite(highestConfidence)
      ? highestConfidence.toFixed(6)
      : "N/A"
  );

  console.log(
    "Best Class:",
    CLASS_NAMES[bestClassIndex] ?? "Unknown"
  );

  console.log(
    "Best Candidate Index:",
    bestCandidateIndex
  );

  console.log(
    "Confidence Threshold:",
    CONFIDENCE_THRESHOLD
  );

  console.log(
    "Candidates Above Threshold:",
    aboveThresholdCount
  );

  console.log(
    "Candidates With Valid Boxes:",
    detections.length
  );

  console.log(
    "Invalid Class Scores:",
    invalidScores
  );

  const finalDetections = applyNMS(detections);

  console.log(
    "Detections After NMS:",
    finalDetections.length
  );

  console.log("=================================\n");

  return {
    detections: finalDetections,
    debug: {
      totalCandidates: numCandidates,
      highestConfidence:
        Number.isFinite(highestConfidence)
          ? highestConfidence
          : null,
      bestClass:
        CLASS_NAMES[bestClassIndex] ?? null,
      bestCandidateIndex,
      confidenceThreshold: CONFIDENCE_THRESHOLD,
      aboveThresholdCount,
      validBoxCount: detections.length,
      invalidScores,
    },
  };
}

// ==========================================
// 5. DRAW DETECTIONS
// ==========================================

async function drawDetections(
  imageInfo,
  detections,
  outputPath
) {
  const svgBoxes = detections.map((d) => {
    const x = d.x1;
    const y = d.y1;

    const width = d.x2 - d.x1;
    const height = d.y2 - d.y1;

    const label = `${d.className} ${(
      d.confidence * 100
    ).toFixed(1)}%`;

    const safeLabel = label
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const labelWidth = Math.min(
      imageInfo.originalWidth - x,
      Math.max(120, label.length * 8 + 12)
    );

    const labelY = y >= 30 ? y - 28 : y;

    return `
      <rect
        x="${x}"
        y="${y}"
        width="${width}"
        height="${height}"
        fill="none"
        stroke="#00C896"
        stroke-width="3"
      />

      <rect
        x="${x}"
        y="${labelY}"
        width="${labelWidth}"
        height="27"
        fill="#00C896"
      />

      <text
        x="${x + 5}"
        y="${labelY + 18}"
        font-size="14"
        font-family="Arial"
        fill="#000000"
      >${safeLabel}</text>
    `;
  }).join("");

  const svg = `
    <svg
      width="${imageInfo.originalWidth}"
      height="${imageInfo.originalHeight}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${svgBoxes}
    </svg>
  `;

  await sharp(imageInfo.orientedBuffer)
    .composite([
      { input: Buffer.from(svg) },
    ])
    .jpeg({ quality: 95 })
    .toFile(outputPath);
}

// ==========================================
// 6. MAIN
// ==========================================

async function main() {
  console.log(
    "\nDermaCare AI - ONNX Inference Test\n"
  );

  await fs.mkdir(OUTPUT_DIR, {
    recursive: true,
  });

  console.log("Loading ONNX model...");

  const session = await ort.InferenceSession.create(
    MODEL_PATH,
    {
      executionProviders: ["cpu"],
    }
  );

  console.log("Model loaded successfully!");

  console.log("\nPreprocessing image...");

  const imageInfo = await preprocessImage(
    IMAGE_PATH
  );

  console.log(
    "Original Image:",
    imageInfo.originalWidth,
    "x",
    imageInfo.originalHeight
  );

  console.log(
    "Input Tensor:",
    imageInfo.tensor.dims
  );

  console.log("\nRunning inference...");

  const startTime = performance.now();

  const results = await session.run({
    [session.inputNames[0]]: imageInfo.tensor,
  });

  const inferenceTime =
    performance.now() - startTime;

  console.log(
    `Inference completed in ${inferenceTime.toFixed(2)} ms`
  );

  const output = results[session.outputNames[0]];

  console.log("\nDecoding predictions...");

  const { detections, debug } = decodeOutput(
    output,
    imageInfo
  );

  console.log(
    "\nTotal Detections:",
    detections.length
  );

  if (detections.length === 0) {
    console.log(
      "No detections above confidence threshold."
    );
  }

  for (const [index, detection] of detections.entries()) {
    console.log(`\nDetection ${index + 1}`);

    console.log("Class:", detection.className);

    console.log(
      "Confidence:",
      `${(detection.confidence * 100).toFixed(2)}%`
    );

    console.log("Bounding Box:", {
      x: Math.round(detection.x1),
      y: Math.round(detection.y1),
      width: Math.round(
        detection.x2 - detection.x1
      ),
      height: Math.round(
        detection.y2 - detection.y1
      ),
    });
  }

  const imageOutput = path.join(
    OUTPUT_DIR,
    "skin-test-result.jpg"
  );

  const jsonOutput = path.join(
    OUTPUT_DIR,
    "skin-test-result.json"
  );

  await drawDetections(
    imageInfo,
    detections,
    imageOutput
  );

  const jsonResult = {
    model: "veritaderm.onnx",
    inferenceTimeMs: Number(
      inferenceTime.toFixed(2)
    ),
    totalDetections: detections.length,
    debug,
    detections: detections.map((d) => ({
      classId: d.classId,
      className: d.className,
      confidence: Number(
        d.confidence.toFixed(4)
      ),
      boundingBox: {
        x: Math.round(d.x1),
        y: Math.round(d.y1),
        width: Math.round(d.x2 - d.x1),
        height: Math.round(d.y2 - d.y1),
      },
    })),
  };

  await fs.writeFile(
    jsonOutput,
    JSON.stringify(jsonResult, null, 2)
  );

  console.log("\nResults saved successfully!");
  console.log("Image:", imageOutput);
  console.log("JSON:", jsonOutput);
}

main().catch((error) => {
  console.error("\nInference failed:");
  console.error(error);
  process.exitCode = 1;
});