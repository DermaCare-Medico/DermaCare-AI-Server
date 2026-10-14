
import ort from "onnxruntime-node";

const modelPath = "model/vit-skin-disease/model.onnx";

async function main() {
  console.log("Loading ViT Skin Disease Model...");

  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ["cpu"],
  });

  console.log("Model loaded successfully!");

  console.log("Input names:", session.inputNames);
  console.log("Output names:", session.outputNames);

  for (const name of session.inputNames) {
    console.log("Input metadata:", name, session.inputMetadata[name]);
  }

  for (const name of session.outputNames) {
    console.log("Output metadata:", name, session.outputMetadata[name]);
  }
}

main().catch(console.error);
