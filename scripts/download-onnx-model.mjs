import { createWriteStream } from "node:fs";
import { access, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const repository = "nishatjahan62/INT8.ONNX";
const revision = "main";
const filename = "model-int8.onnx";
const destination = path.resolve(
  process.cwd(),
  "model",
  "vit-skin-disease",
  filename,
);
const temporaryDestination = `${destination}.download`;

const token = process.env.HF_TOKEN?.trim();
if (!token) {
  throw new Error(
    "HF_TOKEN is required to download the private ONNX model during the build.",
  );
}

async function isUsableFile(filePath) {
  try {
    await access(filePath);
    return (await stat(filePath)).size > 0;
  } catch {
    return false;
  }
}

if (await isUsableFile(destination)) {
  console.log(`ONNX model already exists at ${path.relative(process.cwd(), destination)}.`);
  process.exit(0);
}

const url = new URL(
  `https://huggingface.co/${repository}/resolve/${revision}/${filename}`,
);

await mkdir(path.dirname(destination), { recursive: true });
await rm(temporaryDestination, { force: true });

try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Hugging Face model download failed with HTTP ${response.status} ${response.statusText}.`,
    );
  }
  if (!response.body) {
    throw new Error("Hugging Face model download returned an empty response body.");
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(temporaryDestination, { flags: "wx" }),
  );

  if (!(await isUsableFile(temporaryDestination))) {
    throw new Error("Downloaded ONNX model is empty or unavailable.");
  }

  await rename(temporaryDestination, destination);
  const downloaded = await stat(destination);
  console.log(
    `Downloaded ONNX model to ${path.relative(process.cwd(), destination)} (${downloaded.size} bytes).`,
  );
} catch (error) {
  await rm(temporaryDestination, { force: true });
  throw error;
}
