
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

// ==========================================
// CONFIGURATION
// ==========================================

const MODEL_PATH = path.resolve(
  process.cwd(),
  "model",
  "veritaderm.onnx"
);

const IMAGE_PATH = path.resolve(
  process.cwd(),
  "test-images",
  "skin-test.jpg"
);

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "test-results"
);

const INPUT_SIZE = 640;

const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

const CLASS_NAMES = [
  "Acne",
  "Chicken Skin (Keratosis Pilaris)",
  "Eczema",
  "Leprosy",
  "Psoriasis",
  "Ringworm",
  "Warts",
  "Healthy Skin",
];

// IMPORTANT:
// Verify this order against training metadata.

// ==========================================
// STEP 1: IMAGE PREPROCESSING
// ==========================================

async function preprocessImage(imagePath) {
  const metadata = await sharp(imagePath).metadata();

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("Invalid image dimensions");
  }

  // Preserve aspect ratio using letterboxing
  const scale = Math.min(
    INPUT_SIZE / originalWidth,
    INPUT_SIZE / originalHeight
  );

  const resizedWidth = Math.round(originalWidth * scale);
  const resizedHeight = Math.round(originalHeight * scale);

  const padX = Math.floor(
    (INPUT_SIZE - resizedWidth) / 2
  );

  const padY = Math.floor(
    (INPUT_SIZE - resizedHeight) / 2
  );

  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize(INPUT_SIZE, INPUT_SIZE, {
      fit: "contain",
      background: {
        r: 114,
        g: 114,
        b: 114,
        alpha: 1,
      },
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  const channelSize = width * height;

  const floatData = new Float32Array(
    3 * channelSize
  );

  // Convert HWC -> CHW
  // Normalize pixel values 0-255 -> 0-1

  for (let i = 0; i < channelSize; i++) {
    const pixelIndex = i * 3;

    floatData[i] = data[pixelIndex] / 255;

    floatData[channelSize + i] =
      data[pixelIndex + 1] / 255;

    floatData[2 * channelSize + i] =
      data[pixelIndex + 2] / 255;
  }

  const tensor = new ort.Tensor(
    "float32",
    floatData,
    [1, 3, INPUT_SIZE, INPUT_SIZE]
  );

  return {
    tensor,
    originalWidth,
    originalHeight,
    scale,
    padX,
    padY,
  };
}

// ==========================================
// STEP 2: IOU CALCULATION
// ==========================================

function calculateIoU(boxA, boxB) {
  const x1 = Math.max(boxA.x1, boxB.x1);
  const y1 = Math.max(boxA.y1, boxB.y1);

  const x2 = Math.min(boxA.x2, boxB.x2);
  const y2 = Math.min(boxA.y2, boxB.y2);

  const intersectionWidth = Math.max(0, x2 - x1);
  const intersectionHeight = Math.max(0, y2 - y1);

  const intersection =
    intersectionWidth * intersectionHeight;

  const areaA =
    (boxA.x2 - boxA.x1) *
    (boxA.y2 - boxA.y1);

  const areaB =
    (boxB.x2 - boxB.x1) *
    (boxB.y2 - boxB.y1);

  const union = areaA + areaB - intersection;

  if (union <= 0) return 0;

  return intersection / union;
}

// ==========================================
// STEP 3: NON-MAXIMUM SUPPRESSION
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

      // Apply NMS within the same class
      if (candidate.classId !== best.classId) {
        continue;
      }

      const iou = calculateIoU(best, candidate);

      if (iou > IOU_THRESHOLD) {
        sorted.splice(i, 1);
      }
    }
  }

  return selected;
}

// ==========================================
// STEP 4: DECODE MODEL OUTPUT
// ==========================================

function decodeOutput(output, imageInfo) {
  const data = output.data;
  const dims = output.dims;

  console.log("Output shape:", dims);

  if (
    dims.length !== 3 ||
    dims[0] !== 1 ||
    dims[1] !== 12
  ) {
    throw new Error(
      `Unexpected output shape: ${dims.join(", ")}`
    );
  }

  const numCandidates = dims[2];
  const numClasses = CLASS_NAMES.length;

  const detections = [];

  for (let i = 0; i < numCandidates; i++) {
    // YOLO output: [1, 4 + classes, candidates]
    const cx = data[0 * numCandidates + i];
    const cy = data[1 * numCandidates + i];

    const w = data[2 * numCandidates + i];
    const h = data[3 * numCandidates + i];

    let bestScore = 0;
    let bestClass = -1;

    for (let c = 0; c < numClasses; c++) {
      const score =
        data[(4 + c) * numCandidates + i];

      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (
      bestScore < CONFIDENCE_THRESHOLD ||
      bestClass === -1
    ) {
      continue;
    }

    // Convert center coordinates to corners
    // Undo letterbox padding and scale

    const x1 = (cx - w / 2 - imageInfo.padX) /
      imageInfo.scale;

    const y1 = (cy - h / 2 - imageInfo.padY) /
      imageInfo.scale;

    const x2 = (cx + w / 2 - imageInfo.padX) /
      imageInfo.scale;

    const y2 = (cy + h / 2 - imageInfo.padY) /
      imageInfo.scale;

    const box = {
      x1: Math.max(0, Math.min(imageInfo.originalWidth, x1)),
      y1: Math.max(0, Math.min(imageInfo.originalHeight, y1)),
      x2: Math.max(0, Math.min(imageInfo.originalWidth, x2)),
      y2: Math.max(0, Math.min(imageInfo.originalHeight, y2)),
    };

    if (box.x2 <= box.x1 || box.y2 <= box.y1) {
      continue;
    }

    detections.push({
      classId: bestClass,
      className: CLASS_NAMES[bestClass],
      confidence: bestScore,
      ...box,
    });
  }

  console.log(
    "Candidates after confidence filtering:",
    detections.length
  );

  return applyNMS(detections);
}

// ==========================================
// STEP 5: DRAW BOUNDING BOXES
// ==========================================

async function drawDetections(
  imagePath,
  detections,
  outputPath,
  imageInfo
) {
  const svgBoxes = detections.map((detection) => {
    const x = detection.x1;
    const y = detection.y1;

    const width = detection.x2 - detection.x1;
    const height = detection.y2 - detection.y1;

    const label = `${detection.className} ${(
      detection.confidence * 100
    ).toFixed(1)}%`;

    const safeLabel = label
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

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

  await sharp(imagePath)
    .rotate()
    .composite([
      {
        input: Buffer.from(svg),
      },
    ])
    .jpeg({ quality: 95 })
    .toFile(outputPath);
}

// ==========================================
// STEP 6: MAIN INFERENCE FUNCTION
// ==========================================

async function main() {
  console.log("\nDermaCare AI - Image Inference Test\n");

  await fs.mkdir(OUTPUT_DIR, {
    recursive: true,
  });

  console.log("Loading ONNX model...");

  const session = await ort.InferenceSession.create(
    MODEL_PATH
  );

  console.log("Model loaded successfully!");

  console.log("\nPreprocessing image...");

  const imageInfo = await preprocessImage(
    IMAGE_PATH
  );

  console.log("Input tensor shape:", [
    ...imageInfo.tensor.dims,
  ]);

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

  const detections = decodeOutput(
    output,
    imageInfo
  );

  console.log(
    "\nTotal detections:",
    detections.length
  );

  if (detections.length === 0) {
    console.log(
      "No detections above confidence threshold."
    );
  } else {
    detections.forEach((detection, index) => {
      console.log(`\nDetection ${index + 1}`);

      console.log("Disease:", detection.className);

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
    });
  }

  const resultImagePath = path.join(
    OUTPUT_DIR,
    "skin-test-result.jpg"
  );

  const resultJsonPath = path.join(
    OUTPUT_DIR,
    "skin-test-result.json"
  );

  await drawDetections(
    IMAGE_PATH,
    detections,
    resultImagePath,
    imageInfo
  );

  const jsonResult = {
    model: "veritaderm.onnx",
    inferenceTimeMs: Number(
      inferenceTime.toFixed(2)
    ),
    totalDetections: detections.length,
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
    resultJsonPath,
    JSON.stringify(jsonResult, null, 2)
  );

  console.log("\nResults saved successfully!");

  console.log("Image:", resultImagePath);
  console.log("JSON:", resultJsonPath);
}

// ==========================================
// RUN
// ==========================================

main().catch((error) => {
  console.error("\nInference failed:");
  console.error(error);
  process.exitCode = 1;
});