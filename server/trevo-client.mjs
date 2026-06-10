import { hasTrevoApiKey, serverEnv } from "./env.mjs";

function buildTrevoUrl(pathname, searchParams) {
  const url = new URL(pathname, `${serverEnv.trevoApiBaseUrl}/`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }
  return url;
}

async function requestTrevo(pathname, options = {}) {
  const url = buildTrevoUrl(pathname, options.searchParams);
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Trevo request failed with status ${response.status}`;

    const error = new Error(message);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function getExternalHeaders() {
  if (!hasTrevoApiKey()) {
    return null;
  }

  return {
    "Content-Type": "application/json",
    Origin: serverEnv.trevoApiOrigin,
    "x-api-key": serverEnv.trevoApiKey,
  };
}

export async function fetchPublicCatalog() {
  const payload = await requestTrevo(
    `/api/public/${serverEnv.trevoOrgSlug}/products`,
  );
  return payload?.data ?? payload;
}

export async function createPublicOrder(input) {
  const payload = await requestTrevo(
    `/api/public/${serverEnv.trevoOrgSlug}/orders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: input,
    },
  );

  return payload?.data ?? payload;
}

export async function initPublicPayment(orderId) {
  const payload = await requestTrevo(
    `/api/public/${serverEnv.trevoOrgSlug}/orders/${orderId}/payment/init`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        provider: serverEnv.publicPaymentProvider,
      },
    },
  );

  return payload?.data ?? payload;
}

export async function getPublicOrderStatus(orderId) {
  const payload = await requestTrevo(
    `/api/public/${serverEnv.trevoOrgSlug}/orders/${orderId}/status`,
  );
  return payload?.data ?? payload;
}

export async function getExternalOrderStatus(orderId) {
  const externalHeaders = getExternalHeaders();
  if (!externalHeaders) {
    return null;
  }

  const payload = await requestTrevo(`/api/external/orders/${orderId}`, {
    headers: externalHeaders,
  });

  return payload?.data ?? payload;
}

export async function getStorefrontOrderStatus(orderId) {
  if (hasTrevoApiKey()) {
    try {
      const externalOrder = await getExternalOrderStatus(orderId);
      if (externalOrder) {
        return {
          ...externalOrder,
          source: "external_api",
        };
      }
    } catch (error) {
      console.warn(
        "[Tea Station] Falling back to public order status after external API failure:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const publicOrder = await getPublicOrderStatus(orderId);
  return {
    ...publicOrder,
    source: "public_api",
  };
}
