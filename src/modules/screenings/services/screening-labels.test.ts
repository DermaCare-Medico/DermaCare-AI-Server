import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODEL_CONDITION_LABELS } from "../../../shared/constants/screening.constants.js";

test("ONNX model labels exactly match the Condition seed labels", async () => {
  const config = JSON.parse(await readFile(
    path.resolve(process.cwd(), "model/vit-skin-disease/config.json"),
    "utf8",
  )) as { id2label: Record<string, string> };
  const modelLabels = Object.entries(config.id2label)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, label]) => label);
  assert.deepEqual(modelLabels, [...MODEL_CONDITION_LABELS]);
});
