const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const searchParams = new URLSearchParams(window.location.search);

const STORAGE_KEYS = {
  orgSlug: "trevo-org-slug",
  apiBaseUrl: "trevo-api-base-url",
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

const defaultApiBaseUrl = isLocalhost
  ? "http://127.0.0.1:15000"
  : "https://api.trevo.studio";
const defaultFrontendBaseUrl = isLocalhost
  ? "http://127.0.0.1:17617"
  : "https://app.trevo.studio";

export const trevoConfig = {
  orgSlug: readPersistedOverride("trevo-org", STORAGE_KEYS.orgSlug, "tea-station"),
  apiBaseUrl: readPersistedOverride(
    "trevo-api",
    STORAGE_KEYS.apiBaseUrl,
    defaultApiBaseUrl,
  ),
  frontendBaseUrl: readPersistedOverride(
    "trevo-front",
    STORAGE_KEYS.frontendBaseUrl,
    defaultFrontendBaseUrl,
  ),
  landingOrigin: window.location.origin.replace(/\/$/, ""),
  debug: {
    enabled: readDebugFlag(),
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
        ctaLabel: "Xem dong Matcha",
      },
      {
        key: "white-tea-gift",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["white tea", "tra trang"],
        category: "whitetea",
        eyebrow: "Qua tang tinh te",
        ctaLabel: "Xem dong Tra Trang",
      },
      {
        key: "oolong-daily",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["oolong", "o long"],
        category: "oolong",
        eyebrow: "Ban hang on dinh",
        ctaLabel: "Xem dong Oolong",
      },
      {
        key: "black-tea-story",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["black tea", "tra den", "earl grey"],
        category: "blacktea",
        eyebrow: "Huong vi chu dao",
        ctaLabel: "Xem dong Tra Den",
      },
    ],
    bestSellerCarousel: [
      {
        key: "black-tea-best-seller",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["black tea", "tra den", "earl grey"],
        category: "blacktea",
        eyebrow: "Khach hang yeu thich",
        pitch:
          "Huong vi dam va ro lop, hop cho nhung ai muon mot chen tra co chieu sau.",
        ctaLabel: "Dat ngay",
      },
      {
        key: "matcha-energy",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["matcha"],
        category: "matcha",
        eyebrow: "Nang luong buoi sang",
        pitch:
          "Tong vi tuoi moi, de dua vao combo breakfast va nhom khach hang tre.",
        ctaLabel: "Dat ngay",
      },
      {
        key: "oolong-balance",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["oolong", "o long"],
        category: "oolong",
        eyebrow: "Lua chon de thuong thuc",
        pitch:
          "Can bang giua do dam va hau vi thoang, phu hop cho nhieu khung gio trong ngay.",
        ctaLabel: "Dat ngay",
      },
      {
        key: "white-tea-relax",
        preferredSkus: [],
        preferredIds: [],
        nameIncludes: ["white tea", "tra trang"],
        category: "whitetea",
        eyebrow: "Nhe nhang va tinh te",
        pitch:
          "Danh cho nhung bo qua tang, tra thu gian va hinh anh thuong hieu thanh lich.",
        ctaLabel: "Dat ngay",
      },
    ],
  },
};
