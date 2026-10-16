import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

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
  "skin-test-2.jpg"
);

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
      `Expected configured bilinear resampling value 2, received ${config.resample}`
    );
  }

  if (
    config.do_resize !== true ||
    config.do_rescale !== true ||
    config.do_normalize !== true
  ) {
    throw new Error(
      "This diagnostic expects resize, rescale, and normalization to be enabled"
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
      `Unexpected preprocessed image shape: ${info.width}x${info.height}x${info.channels}`
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

  const session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ["cpu"],
  });

  // Check RAM usage after loading ONNX model
const memory = process.memoryUsage();

console.log(
  "RAM after model loading:",
  (memory.rss / 1024 / 1024).toFixed(2),
  "MB"
);

if (!session.inputNames.includes("pixel_values")) {
  throw new Error(
    `Model does not expose pixel_values; inputs: ${session.inputNames.join(", ")}`
  );
}

  // if (!session.inputNames.includes("pixel_values")) {
  //   throw new Error(
  //     `Model does not expose pixel_values; inputs: ${session.inputNames.join(", ")}`
  //   );
  // }

  const outputs = await session.run({
    pixel_values: inputTensor,
  });

// RAM usage after inference
console.log(
  "RAM after inference:",
  (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
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

  if (probabilities.length !== Object.keys(modelConfig.id2label).length) {
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

  console.log("Input tensor shape:", inputTensor.dims);
  console.log("Output tensor shape:", logitsTensor.dims);
  console.log("Top 5 predictions:");

  for (const [index, prediction] of topFive.entries()) {
    console.log(
      `${index + 1}. ${prediction.className} ` +
      `(class ${prediction.classId}): ` +
      `${prediction.score.toFixed(8)} ` +
      `(${(prediction.score * 100).toFixed(4)}%)`
    );
  }

  console.log(
    "Note: Sharp and Pillow resizing can produce different pixels; " +
    "exact Hugging Face parity requires comparing logits and predictions " +
    "for this same image in Google Colab."
  );
}

main().catch((error) => {
  console.error("ViT inference diagnostic failed:");
  console.error(error);
  process.exitCode = 1;
});

if (global.gc) {
  global.gc();
}

const memory = process.memoryUsage();

console.log("\n--- Memory Usage ---");

console.log(
  "RSS:",
  (memory.rss / 1024 / 1024).toFixed(2),
  "MB"
);

console.log(
  "Heap Used:",
  (memory.heapUsed / 1024 / 1024).toFixed(2),
  "MB"
);

console.log(
  "External:",
  (memory.external / 1024 / 1024).toFixed(2),
  "MB"
);
