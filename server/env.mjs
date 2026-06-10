import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const env = {};

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

    env[key] = value;
  }

  return env;
}

function normalizeBaseUrl(value, fallbackValue) {
  return String(value || fallbackValue).replace(/\/+$/, "");
}

function asPort(value, fallbackValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return parsed;
}

const mergedFileEnv = {
  ...parseEnvFile(path.join(projectRoot, ".env")),
  ...parseEnvFile(path.join(projectRoot, ".env.server")),
};

const sourceEnv = {
  ...mergedFileEnv,
  ...process.env,
};

const defaultSiteDir =
  sourceEnv.NODE_ENV === "production"
    ? path.join(projectRoot, "site")
    : projectRoot;

export const serverEnv = {
  projectRoot,
  port: asPort(sourceEnv.PORT, 3200),
  siteDir: path.resolve(projectRoot, sourceEnv.SITE_DIR || defaultSiteDir),
  storefrontName: sourceEnv.STOREFRONT_NAME || "Tea Station",
  trevoOrgSlug: sourceEnv.TREVO_ORG_SLUG || "tea-store",
  trevoApiBaseUrl: normalizeBaseUrl(
    sourceEnv.TREVO_API_BASE_URL,
    "https://api.trevo.studio",
  ),
  trevoFrontendBaseUrl: normalizeBaseUrl(
    sourceEnv.TREVO_FRONTEND_BASE_URL,
    "https://app.trevo.studio",
  ),
  trevoApiOrigin: sourceEnv.TREVO_API_ORIGIN || "https://tea.trevo.studio",
  trevoApiKey: sourceEnv.TREVO_API_KEY || "",
  publicPaymentProvider: sourceEnv.TREVO_PUBLIC_PAYMENT_PROVIDER || "sepay",
};

export function hasTrevoApiKey() {
  return serverEnv.trevoApiKey.trim().length > 0;
}
