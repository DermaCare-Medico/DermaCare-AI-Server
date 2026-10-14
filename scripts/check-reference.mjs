
import fs from "node:fs";
import ort from "onnxruntime-node";

const buffer = fs.readFileSync("test-images/reference-input.bin");

const data = new Float32Array(
  buffer.buffer,
  buffer.byteOffset,
  buffer.byteLength / 4
);

const session = await ort.InferenceSession.create(
  "model/veritaderm.onnx"
);

const input = new ort.Tensor("float32", data, [1, 3, 640, 640]);

const outputs = await session.run({
  [session.inputNames[0]]: input,
});

const output = outputs[session.outputNames[0]];
const scores = output.data;

const numCandidates = output.dims[2];
const numClasses = output.dims[1] - 4;

let best = { score: -1, classId: -1, index: -1 };

for (let i = 0; i < numCandidates; i++) {
  for (let c = 0; c < numClasses; c++) {
    const score = scores[(c + 4) * numCandidates + i];

    if (score > best.score) {
      best = { score, classId: c, index: i };
    }
  }
}

console.log({
  inputShape: input.dims,
  outputShape: output.dims,
  best,
});
