
import * as ort from "onnxruntime-node";
import path from "node:path";

async function main() {
  const modelPath = path.resolve(
    process.cwd(),
    "model",
    "veritaderm.onnx"
  );

  const session = await ort.InferenceSession.create(modelPath);

  console.log("\nModel loaded successfully!");

  console.log("\nInput names:");
  console.log(session.inputNames);

  console.log("\nInput metadata:");
  console.dir(session.inputMetadata, { depth: 5 });

  console.log("\nOutput names:");
  console.log(session.outputNames);

  console.log("\nOutput metadata:");
  console.dir(session.outputMetadata, { depth: 5 });
}

main().catch((error) => {
  console.error("Model loading failed:", error);
  process.exitCode = 1;
});
