import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const envPath = resolve(rootDir, ".env");
const outputPath = resolve(rootDir, "runtime-config.js");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function asBoolean(value, fallbackValue = false) {
  if (value == null || value === "") {
    return fallbackValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const fileEnv = parseEnvFile(envPath);
const env = {
  ...fileEnv,
  ...process.env,
};

const runtimeConfig = {
  orgSlug: env.TREVO_ORG_SLUG || "tea-store",
  storefrontApiBaseUrl: env.TEA_STATION_API_BASE_URL || "",
  trevoApiBaseUrl: env.TREVO_API_BASE_URL || "https://api.trevo.studio",
  frontendBaseUrl: env.TREVO_FRONTEND_BASE_URL || "https://app.trevo.studio",
  debug: asBoolean(env.TREVO_DEBUG, false),
};

const fileContent = `window.__TREVO_RUNTIME_CONFIG__ = ${JSON.stringify(
  runtimeConfig,
  null,
  2,
)};\n`;

writeFileSync(outputPath, fileContent, "utf8");

console.log(`Generated runtime config at ${outputPath}`);
