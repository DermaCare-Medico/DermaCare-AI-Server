
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";

const ROOT = process.cwd();

const MODEL_PATH = path.join(
  ROOT,
  "model",
  "vit-skin-disease",
  "model.onnx"
);

const CONFIG_PATH = path.join(
  ROOT,
  "model",
  "vit-skin-disease",
  "config.json"
);

const PREPROCESSOR_CONFIG_PATH = path.join(
  ROOT,
  "model",
  "vit-skin-disease",
  "preprocessor_config.json"
);

const IMAGE_PATH = path.join(
  ROOT,
  "test-images",
  "skin-test.jpg"
);

function getMemoryMB() {
  return Number(
    (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
  );
}

async function loadJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function validatePreprocessorConfig(config) {
  const width = config.size?.width;
  const height = config.size?.height;

  if (width !== 224 || height !== 224) {
    throw new Error(
      `Expected configured image size 224x224, received ${width}x${height}`
    );
  }

  if (config.resample !== 2) {
    throw new Error(
      `Expected bilinear resampling value 2, received ${config.resample}`
    );
  }

  if (
    config.do_resize !== true ||
    config.do_rescale !== true ||
    config.do_normalize !== true
  ) {
    throw new Error(
      "Resize, rescale and normalization must be enabled"
    );
  }

  if (
    !Array.isArray(config.image_mean) ||
    config.image_mean.length !== 3 ||
    !Array.isArray(config.image_std) ||
    config.image_std.length !== 3 ||
    !config.image_std.every((value) => value !== 0) ||
    !Number.isFinite(config.rescale_factor)
  ) {
    throw new Error("Invalid ViT preprocessing configuration");
  }
}

async function preprocessImage(imagePath, config) {
  const width = config.size.width;
  const height = config.size.height;

  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.linear,
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (
    info.width !== width ||
    info.height !== height ||
    info.channels !== 3
  ) {
    throw new Error(
      `Unexpected image shape: ${info.width}x${info.height}x${info.channels}`
    );
  }

  const channelSize = width * height;
  const tensorData = new Float32Array(3 * channelSize);

  for (let i = 0; i < channelSize; i++) {
    const pixelIndex = i * 3;

    for (let channel = 0; channel < 3; channel++) {
      const rescaled =
        data[pixelIndex + channel] * config.rescale_factor;

      tensorData[channel * channelSize + i] =
        (rescaled - config.image_mean[channel]) /
        config.image_std[channel];
    }
  }

  return new ort.Tensor(
    "float32",
    tensorData,
    [1, 3, height, width]
  );
}

function softmax(logits) {
  const maxLogit = Math.max(...logits);

  const exponentials = logits.map((value) =>
    Math.exp(value - maxLogit)
  );

  const sum = exponentials.reduce(
    (total, value) => total + value,
    0
  );

  return exponentials.map((value) => value / sum);
}

async function main() {
  console.log("\n=== DermaCare AI — INT8 Model Test ===\n");

  const [modelConfig, preprocessorConfig] = await Promise.all([
    loadJson(CONFIG_PATH),
    loadJson(PREPROCESSOR_CONFIG_PATH),
  ]);

  validatePreprocessorConfig(preprocessorConfig);

  if (!modelConfig.id2label) {
    throw new Error("Model config does not contain id2label");
  }

  const inputTensor = await preprocessImage(
    IMAGE_PATH,
    preprocessorConfig
  );

  console.log("Model: INT8");
  console.log("Image:", path.basename(IMAGE_PATH));

  const modelLoadStart = performance.now();

  const session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ["cpu"],
  });

  const modelLoadTime = performance.now() - modelLoadStart;

  console.log("\n--- Model Loading ---");
  console.log(
    "Load Time:",
    modelLoadTime.toFixed(2),
    "ms"
  );
  console.log(
    "RAM after model loading:",
    getMemoryMB(),
    "MB"
  );

  if (!session.inputNames.includes("pixel_values")) {
    throw new Error(
      `Model does not expose pixel_values; inputs: ${session.inputNames.join(", ")}`
    );
  }

  const inferenceStart = performance.now();

  const outputs = await session.run({
    pixel_values: inputTensor,
  });

  const inferenceTime = performance.now() - inferenceStart;

  console.log("\n--- Inference Performance ---");
  console.log(
    "Inference Time:",
    inferenceTime.toFixed(2),
    "ms"
  );
  console.log(
    "RAM after inference:",
    getMemoryMB(),
    "MB"
  );

  const logitsTensor = outputs.logits;

  if (!logitsTensor) {
    throw new Error(
      `Model does not expose logits; outputs: ${session.outputNames.join(", ")}`
    );
  }

  const logits = Array.from(logitsTensor.data);
  const probabilities = softmax(logits);

  if (
    probabilities.length !==
    Object.keys(modelConfig.id2label).length
  ) {
    throw new Error(
      `Logit count ${probabilities.length} does not match label count ${Object.keys(modelConfig.id2label).length}`
    );
  }

  const topFive = probabilities
    .map((score, classId) => ({
      classId,
      className:
        modelConfig.id2label[String(classId)] ?? "Unknown",
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  console.log("\n--- Prediction Results ---");
  console.log("Input tensor shape:", inputTensor.dims);
  console.log("Output tensor shape:", logitsTensor.dims);
  console.log("\nTop 5 predictions:");

  for (const [index, prediction] of topFive.entries()) {
    console.log(
      `${index + 1}. ${prediction.className} ` +
      `(class ${prediction.classId}): ` +
      `${prediction.score.toFixed(8)} ` +
      `(${(prediction.score * 100).toFixed(4)}%)`
    );
  }

  console.log(
    "\nNote: Softmax scores are not clinical diagnostic probabilities."
  );

  console.log("\n=== Test Completed ===");
}

main().catch((error) => {
  console.error("\nINT8 inference test failed:");
  console.error(error);
  process.exitCode = 1;
});
