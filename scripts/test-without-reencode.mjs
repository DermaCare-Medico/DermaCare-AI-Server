import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";

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

async function preprocessImage(imagePath) {
  // Apply EXIF orientation before measuring
  const image = sharp(imagePath).rotate();

  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image dimensions");
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

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

  // Resize the original image directly without an intermediate JPEG.
  const resized = await sharp(imagePath)
    .rotate()
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

  return new ort.Tensor(
    "float32",
    tensorData,
    [1, 3, INPUT_SIZE, INPUT_SIZE]
  );
}

async function main() {
  const tensor = await preprocessImage(IMAGE_PATH);
  const session = await ort.InferenceSession.create(
    MODEL_PATH,
    {
      executionProviders: ["cpu"],
    }
  );

  const outputs = await session.run({
    [session.inputNames[0]]: tensor,
  });

  const output = outputs[session.outputNames[0]];
  const scores = output.data;
  const numCandidates = output.dims[2];
  const numClasses = output.dims[1] - 4;

  let highest = {
    score: -Infinity,
    classId: -1,
    candidateIndex: -1,
  };

  for (let i = 0; i < numCandidates; i++) {
    for (let classId = 0; classId < numClasses; classId++) {
      const score = scores[(classId + 4) * numCandidates + i];

      if (score > highest.score) {
        highest = {
          score,
          classId,
          candidateIndex: i,
        };
      }
    }
  }

  console.log({
    highestRawClassScore: highest.score,
    classId: highest.classId,
    diseaseName: CLASS_NAMES[highest.classId] ?? "Unknown",
    candidateIndex: highest.candidateIndex,
  });
}

main().catch((error) => {
  console.error("No-reencode diagnostic failed:");
  console.error(error);
  process.exitCode = 1;
});
