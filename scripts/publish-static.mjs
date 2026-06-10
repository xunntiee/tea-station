import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publishDir = path.join(projectRoot, "site");

const publicFiles = [
  "index.html",
  "products.html",
  "checkout.html",
  "runtime-config.js",
];

const publicDirectories = [
  "assets",
  "css",
  "dist",
  "js",
];

async function copyPublicAsset(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(publishDir, relativePath);
  await cp(source, destination, { recursive: true });
}

async function main() {
  await rm(publishDir, { recursive: true, force: true });
  await mkdir(publishDir, { recursive: true });

  for (const relativePath of publicFiles) {
    await copyPublicAsset(relativePath);
  }

  for (const relativePath of publicDirectories) {
    await copyPublicAsset(relativePath);
  }

  await writeFile(path.join(publishDir, ".nojekyll"), "");

  console.log(`Published Tea Station static site to ${publishDir}`);
}

main().catch((error) => {
  console.error("Failed to publish Tea Station static site.");
  console.error(error);
  process.exitCode = 1;
});
