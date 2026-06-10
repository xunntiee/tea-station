const CART_STORAGE_KEY = "trevo-cart-items";
const CART_EVENT_NAME = "trevo-cart-updated";

function sanitizeQuantity(value) {
  const quantity = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

function normalizeCartItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const merged = new Map();

  for (const item of items) {
    const productId = String(item?.productId ?? "").trim();
    if (!productId) {
      continue;
    }

    const quantity = sanitizeQuantity(item?.quantity);
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function readRawCart() {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRawCart(value) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, value);
  } catch {
    // Ignore storage issues in restricted environments.
  }
}

function removeRawCart() {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignore storage issues in restricted environments.
  }
}

function dispatchCartUpdated(items) {
  window.dispatchEvent(
    new CustomEvent(CART_EVENT_NAME, {
      detail: {
        items,
        count: getCartItemCount(items),
      },
    }),
  );
}

export function getStoredCartItems() {
  const raw = readRawCart();
  if (!raw) {
    return [];
  }

  try {
    return normalizeCartItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function setStoredCartItems(items) {
  const normalizedItems = normalizeCartItems(items);
  if (normalizedItems.length === 0) {
    removeRawCart();
  } else {
    writeRawCart(JSON.stringify(normalizedItems));
  }

  dispatchCartUpdated(normalizedItems);
  return normalizedItems;
}

export function addToCart(productId, quantity = 1) {
  const nextItems = normalizeCartItems([
    ...getStoredCartItems(),
    { productId, quantity: sanitizeQuantity(quantity) },
  ]);

  return setStoredCartItems(nextItems);
}

export function removeFromCart(productId) {
  const nextItems = getStoredCartItems().filter(
    (item) => item.productId !== productId,
  );

  return setStoredCartItems(nextItems);
}

export function clearCart() {
  return setStoredCartItems([]);
}

export function getCartItemCount(items = getStoredCartItems()) {
  return items.reduce((total, item) => total + sanitizeQuantity(item.quantity), 0);
}

export function subscribeToCartUpdates(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const handler = (event) => {
    callback(event.detail ?? { items: getStoredCartItems(), count: getCartItemCount() });
  };

  window.addEventListener(CART_EVENT_NAME, handler);
  return () => window.removeEventListener(CART_EVENT_NAME, handler);
}

export function bootstrapCartState() {
  dispatchCartUpdated(getStoredCartItems());
}
