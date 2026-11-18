import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARTIFACT_EXTENSIONS = /\.(exe|msi|blockmap|yml|zip)$/i;

export function writeChecksumsFile(distDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Distribution directory not found: ${distDir}`);
  }

  const files = fs
    .readdirSync(distDir)
    .filter((name) => ARTIFACT_EXTENSIONS.test(name) && name !== "SHA256SUMS.txt")
    .sort();

  if (!files.length) {
    throw new Error(`No installer artifacts found in ${distDir}`);
  }

  const lines = files.map((filename) => {
    const filePath = path.join(distDir, filename);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    return `${digest}  ${filename}`;
  });

  const outPath = path.join(distDir, "SHA256SUMS.txt");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  return outPath;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
  const out = writeChecksumsFile(distDir);
  console.log("[LabMate Desktop] Generated checksums:", out);
}
