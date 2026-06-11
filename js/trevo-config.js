const runtimeConfig = window.__TREVO_RUNTIME_CONFIG__ || {};
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const searchParams = new URLSearchParams(window.location.search);

const STORAGE_KEYS = {
  orgSlug: "trevo-org-slug",
  storefrontApiBaseUrl: "trevo-storefront-api-base-url",
  trevoApiBaseUrl: "trevo-origin-api-base-url",
  frontendBaseUrl: "trevo-frontend-base-url",
  debug: "trevo-debug-enabled",
};

function shouldEnableFromValue(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage issues in restricted environments.
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage issues in restricted environments.
  }
}

function clearTrevoOverridesIfRequested() {
  if (!shouldEnableFromValue(searchParams.get("trevo-reset"))) {
    return;
  }

  Object.values(STORAGE_KEYS).forEach((key) => {
    removeStorage(key);
  });
}

function readPersistedOverride(queryKey, storageKey, fallbackValue) {
  const queryValue = searchParams.get(queryKey)?.trim();
  if (queryValue) {
    writeStorage(storageKey, queryValue);
    return queryValue;
  }

  const persistedValue = readStorage(storageKey)?.trim();
  if (persistedValue) {
    return persistedValue;
  }

  return fallbackValue;
}

function readDebugFlag() {
  const queryValue = searchParams.get("trevo-debug");
  if (queryValue !== null) {
    const enabled = shouldEnableFromValue(queryValue);
    writeStorage(STORAGE_KEYS.debug, enabled ? "1" : "0");
    return enabled;
  }

  return shouldEnableFromValue(readStorage(STORAGE_KEYS.debug));
}

clearTrevoOverridesIfRequested();

const defaultStorefrontApiBaseUrl =
  runtimeConfig.storefrontApiBaseUrl ||
  (isLocalhost ? "http://127.0.0.1:3200" : window.location.origin.replace(/\/$/, ""));
const defaultTrevoApiBaseUrl =
  runtimeConfig.trevoApiBaseUrl ||
  (isLocalhost ? "http://127.0.0.1:15000" : "https://api.trevo.studio");
const defaultFrontendBaseUrl =
  runtimeConfig.frontendBaseUrl ||
  (isLocalhost ? "http://127.0.0.1:17617" : "https://app.trevo.studio");

export const trevoConfig = {
  orgSlug: readPersistedOverride(
    "trevo-org",
    STORAGE_KEYS.orgSlug,
    runtimeConfig.orgSlug || "tea-store",
  ),
  storefrontApiBaseUrl: readPersistedOverride(
    "trevo-api",
    STORAGE_KEYS.storefrontApiBaseUrl,
    defaultStorefrontApiBaseUrl,
  ),
  trevoApiBaseUrl: readPersistedOverride(
    "trevo-origin-api",
    STORAGE_KEYS.trevoApiBaseUrl,
    defaultTrevoApiBaseUrl,
  ),
  frontendBaseUrl: readPersistedOverride(
    "trevo-front",
    STORAGE_KEYS.frontendBaseUrl,
    defaultFrontendBaseUrl,
  ),
  landingOrigin: window.location.origin.replace(/\/$/, ""),
  debug: {
    enabled: searchParams.get("trevo-debug") !== null
      ? readDebugFlag()
      : shouldEnableFromValue(runtimeConfig.debug) || readDebugFlag(),
  },
  merchandising: {
    // Fill preferredSkus or preferredIds after the Tea Station org has final products in Trevo.
    homepageFeatured: [
      {
        key: "matcha-signature",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["matcha"],
        category: "matcha",
        eyebrow: "Tea Station Selection",
        ctaLabel: "Xem dòng Matcha",
      },
      {
        key: "white-tea-gift",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["white tea", "tra trang"],
        category: "whitetea",
        eyebrow: "Quà tặng tinh tế",
        ctaLabel: "Xem dòng Trà Trắng",
      },
      {
        key: "oolong-daily",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["oolong", "o long"],
        category: "oolong",
        eyebrow: "Bán hàng ổn định",
        ctaLabel: "Xem dòng Oolong",
      },
      {
        key: "black-tea-story",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["black tea", "tra den", "earl grey"],
        category: "blacktea",
        eyebrow: "Hương vị chủ đạo",
        ctaLabel: "Xem dòng Trà Đen",
      },
    ],
    bestSellerCarousel: [
      {
        key: "black-tea-best-seller",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["black tea", "tra den", "earl grey"],
        category: "blacktea",
        eyebrow: "Khách hàng yêu thích",
        pitch:
          "Hương vị đậm và rõ lớp, hợp cho những ai muốn một chén trà có chiều sâu.",
        ctaLabel: "Đặt ngay",
      },
      {
        key: "matcha-energy",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["matcha"],
        category: "matcha",
        eyebrow: "Năng lượng buổi sáng",
        pitch:
          "Tông vị tươi mới, dễ đưa vào combo breakfast và nhóm khách hàng trẻ.",
        ctaLabel: "Đặt ngay",
      },
      {
        key: "oolong-balance",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["oolong", "o long"],
        category: "oolong",
        eyebrow: "Lựa chọn để thưởng thức",
        pitch:
          "Cân bằng giữa độ đậm và hậu vị thoảng, phù hợp cho nhiều khung giờ trong ngày.",
        ctaLabel: "Đặt ngay",
      },
      {
        key: "white-tea-relax",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["white tea", "tra trang"],
        category: "whitetea",
        eyebrow: "Nhẹ nhàng và tinh tế",
        pitch:
          "Dành cho những bộ quà tặng, trà thư giãn và hình ảnh thương hiệu thanh lịch.",
        ctaLabel: "Đặt ngay",
      },
    ],
  },
};
