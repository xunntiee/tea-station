import { trevoConfig } from "./trevo-config.js";

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

function stripDiacritics(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
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
  if (normalized.includes("herbal") || normalized.includes("thao moc")) return "herbal";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

export function resolveImageUrl(imageUrl) {
  if (!imageUrl) {
    return "./assets/product_1.jpg";
  }

  try {
    return new URL(imageUrl, trevoConfig.trevoApiBaseUrl).toString();
  } catch {
    if (String(imageUrl).startsWith("/")) {
      return `${trevoConfig.trevoApiBaseUrl}${imageUrl}`;
    }

    return imageUrl;
  }
}

export async function fetchTrevoPublicCatalog() {
  let response;
  try {
    response = await fetch(`${trevoConfig.storefrontApiBaseUrl}/api/storefront/catalog`, {
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to fetch Tea Station API from ${trevoConfig.storefrontApiBaseUrl}. Check whether the Tea Station backend is running.`,
    );
  }

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

  return payload?.data ?? payload;
}

export async function createStorefrontCheckout(input) {
  let response;
  try {
    response = await fetch(`${trevoConfig.storefrontApiBaseUrl}/api/storefront/checkout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(
      `Failed to create checkout session via ${trevoConfig.storefrontApiBaseUrl}.`,
    );
  }

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

  return payload?.data ?? payload;
}

export async function getStorefrontOrderStatus(orderId) {
  let response;
  try {
    response = await fetch(
      `${trevoConfig.storefrontApiBaseUrl}/api/storefront/orders/${encodeURIComponent(orderId)}/status`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );
  } catch {
    throw new Error("Failed to check order status from Tea Station backend.");
  }

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

  return payload?.data ?? payload;
}
