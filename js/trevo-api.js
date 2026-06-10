import { trevoConfig } from "./trevo-config.js";

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

function stripDiacritics(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function formatCurrencyVnd(value) {
  return VND_FORMATTER.format(Number(value ?? 0));
}

export function normalizeProductCategory(value) {
  const normalized = stripDiacritics(String(value ?? ""));
  if (normalized.includes("matcha")) return "matcha";
  if (normalized.includes("oolong") || normalized.includes("o long")) return "oolong";
  if (normalized.includes("black") || normalized.includes("den")) return "blacktea";
  if (normalized.includes("white") || normalized.includes("trang")) return "whitetea";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

export function resolveImageUrl(imageUrl) {
  if (!imageUrl) {
    return "./assets/product_1.jpg";
  }

  try {
    return new URL(imageUrl, trevoConfig.apiBaseUrl).toString();
  } catch {
    if (String(imageUrl).startsWith("/")) {
      return `${trevoConfig.apiBaseUrl}${imageUrl}`;
    }

    return imageUrl;
  }
}

export function buildTrevoCheckoutUrl(items) {
  const url = new URL(
    `/${trevoConfig.orgSlug}/order`,
    trevoConfig.frontendBaseUrl.replace(/\/$/, "") + "/",
  );
  url.searchParams.set(
    "products",
    items.map((item) => `${item.productId}:${item.quantity}`).join(","),
  );
  return url.toString();
}

export async function fetchTrevoPublicCatalog() {
  const response = await fetch(
    `${trevoConfig.apiBaseUrl}/api/public/${trevoConfig.orgSlug}/products`,
    {
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

