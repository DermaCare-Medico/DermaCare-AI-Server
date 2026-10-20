
import { predictSkinImage } from "../src/shared/services/ai/ai-inference.service.ts";

const imagePath = "test-images/skin-test.jpg";

async function main() {
  console.log("Testing AI Inference Service...\n");

  const start = performance.now();
  const firstResult = await predictSkinImage(imagePath);

  console.log("First prediction:", firstResult);
  console.log(`First call: ${(performance.now() - start).toFixed(2)} ms`);

  const secondStart = performance.now();
  const secondResult = await predictSkinImage(imagePath);

  console.log("\nSecond prediction:", secondResult);
  console.log(`Second call: ${(performance.now() - secondStart).toFixed(2)} ms`);

  console.log("\nAI Inference Service test completed.");
}

main().catch((error) => {
  console.error("AI Inference Service test failed:", error);
  process.exitCode = 1;
});
