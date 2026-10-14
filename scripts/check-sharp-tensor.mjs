import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

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

const TENSOR_PATH = path.join(
  ROOT,
  "test-images",
  "sharp-input.bin"
);

const INPUT_SIZE = 640;

// Kept identical to the preprocessing implementation in test-inference.mjs.
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

async function main() {
  const imageInfo = await preprocessImage(IMAGE_PATH);
  const tensorData = imageInfo.tensor.data;

  const tensorBuffer = Buffer.from(
    tensorData.buffer,
    tensorData.byteOffset,
    tensorData.byteLength
  );

  await fs.writeFile(TENSOR_PATH, tensorBuffer);

  const session = await ort.InferenceSession.create(MODEL_PATH);
  const outputs = await session.run({
    [session.inputNames[0]]: imageInfo.tensor,
  });

  const output = outputs[session.outputNames[0]];
  const scores = output.data;
  const numCandidates = output.dims[2];
  const numClasses = output.dims[1] - 4;
  const rawClassCandidates = [];

  for (let i = 0; i < numCandidates; i++) {
    for (let classId = 0; classId < numClasses; classId++) {
      const score = scores[(classId + 4) * numCandidates + i];

      rawClassCandidates.push({
        score,
        classId,
        candidateIndex: i,
      });
    }
  }

  rawClassCandidates.sort((a, b) => b.score - a.score);

  const highest = rawClassCandidates[0];
  const topFive = rawClassCandidates.slice(0, 5).map((candidate) => ({
    classId: candidate.classId,
    candidateIndex: candidate.candidateIndex,
    confidence: candidate.score,
  }));

  console.log({
    inputShape: imageInfo.tensor.dims,
    outputShape: output.dims,
    highestRawClassScore: highest.score,
    classId: highest.classId,
    candidateIndex: highest.candidateIndex,
  });

  console.log("Top 5 raw class candidates:");
  console.table(topFive);
  console.log("Tensor saved:", TENSOR_PATH);
}

main().catch((error) => {
  console.error("Sharp tensor diagnostic failed:");
  console.error(error);
  process.exitCode = 1;
});
