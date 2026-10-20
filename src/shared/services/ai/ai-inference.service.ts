
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import type {
  ModelConfig,
  PreprocessorConfig,
  PredictionResult,
} from "../../../types/ai-inference.types.js";

interface ModelResources {
  session: ort.InferenceSession;
  modelConfig: ModelConfig;
  preprocessorConfig: PreprocessorConfig;
}

const MODEL_DIR = path.resolve(
  process.cwd(),
  "model",
  "vit-skin-disease"
);

const MODEL_PATH = path.join(MODEL_DIR, "model.onnx");
const CONFIG_PATH = path.join(MODEL_DIR, "config.json");
const PREPROCESSOR_CONFIG_PATH = path.join(
  MODEL_DIR,
  "preprocessor_config.json"

);

let resourcesPromise: Promise<ModelResources> | null = null;

async function loadJson<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function validatePreprocessorConfig(
  config: PreprocessorConfig
): void {
  const { width, height } = config.size ?? {};

  if (width !== 224 || height !== 224) {
    throw new Error(
      `Expected image size 224x224, received ${width}x${height}`
    );
  }

  if (
    config.resample !== 2 ||
    config.do_resize !== true ||
    config.do_rescale !== true ||
    config.do_normalize !== true
  ) {
    throw new Error("Invalid preprocessing configuration");
  }

  if (
    !Array.isArray(config.image_mean) ||
    !Array.isArray(config.image_std) ||
    config.image_mean.length !== 3 ||
    config.image_std.length !== 3 ||
    !config.image_mean.every(Number.isFinite) ||
    !config.image_std.every(
      (value) => Number.isFinite(value) && value > 0
    ) ||
    !Number.isFinite(config.rescale_factor)
  ) {
    throw new Error("Invalid ViT normalization configuration");
  }
}

async function loadResources(): Promise<ModelResources> {
  const [modelConfig, preprocessorConfig] = await Promise.all([
    loadJson<ModelConfig>(CONFIG_PATH),
    loadJson<PreprocessorConfig>(PREPROCESSOR_CONFIG_PATH),
  ]);

  if (
    !modelConfig.id2label ||
    Object.keys(modelConfig.id2label).length === 0
  ) {
    throw new Error("Model config does not contain id2label");
  }

  validatePreprocessorConfig(preprocessorConfig);

  const session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ["cpu"],
  });

  if (!session.inputNames.includes("pixel_values")) {
    throw new Error(
      `Expected pixel_values input; received: ${session.inputNames.join(", ")}`
    );
  }

  if (!session.outputNames.includes("logits")) {
    throw new Error(
      `Expected logits output; received: ${session.outputNames.join(", ")}`
    );
  }

  return { session, modelConfig, preprocessorConfig };
}

async function getResources(): Promise<ModelResources> {
  if (!resourcesPromise) {
    resourcesPromise = loadResources().catch((error: unknown) => {
      resourcesPromise = null;
      throw error;
    });
  }

  return resourcesPromise;
}

async function preprocessImage(
  imagePath: string,
  config: PreprocessorConfig
): Promise<ort.Tensor> {
  const { width, height } = config.size;

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
    const pixel = data[pixelIndex + channel];
    const mean = config.image_mean[channel];
    const std = config.image_std[channel];

    if (
      pixel === undefined ||
      mean === undefined ||
      std === undefined
    ) {
      throw new Error("Invalid image data or normalization configuration");
    }

    const rescaled = pixel * config.rescale_factor;

    tensorData[channel * channelSize + i] =
      (rescaled - mean) / std;
  }
}

  return new ort.Tensor("float32", tensorData, [
    1,
    3,
    height,
    width,
  ]);
}

function softmax(logits: number[]): number[] {
  if (
    logits.length === 0 ||
    !logits.every(Number.isFinite)
  ) {
    throw new Error("Model returned invalid logits");
  }

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

export async function predictSkinImage(
  imagePath: string
): Promise<PredictionResult[]> {
  const {
    session,
    modelConfig,
    preprocessorConfig,
  } = await getResources();

  const inputTensor = await preprocessImage(
    imagePath,
    preprocessorConfig
  );

  const outputs = await session.run({
    pixel_values: inputTensor,
  });

  const logitsTensor = outputs.logits;

  if (!logitsTensor) {
    throw new Error("Model did not return logits");
  }

  const logits = Array.from(logitsTensor.data, Number);

  const probabilities = softmax(logits);
  const labels = modelConfig.id2label;

  if (probabilities.length !== Object.keys(labels).length) {
    throw new Error(
      `Logit count ${probabilities.length} does not match label count ${Object.keys(labels).length}`
    );
  }

  return probabilities
    .map((score, classId) => {
      const className = labels[String(classId)];

      if (!className) {
        throw new Error(`Missing label for class ${classId}`);
      }

      return { classId, className, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
