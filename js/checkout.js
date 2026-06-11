import {
  bootstrapCartState,
  clearCart,
  getCartItemCount,
  getStoredCartItems,
  removeFromCart,
  setCartItemQuantity,
  subscribeToCartUpdates,
} from "./trevo-cart.js";
import {
  createStorefrontCheckout,
  fetchTrevoPublicCatalog,
  formatCurrencyVnd,
  getStorefrontOrderStatus,
  resolveImageUrl,
} from "./trevo-api.js";
import { trevoConfig } from "./trevo-config.js";

const CHECKOUT_ROUTE = "/checkout";
const MAX_LINE_ITEM_QTY = 50;

const messageEl = document.getElementById("checkout-message");
const continueEl = document.getElementById("checkout-continue");
const submitEl = document.getElementById("checkout-submit");
const clearEl = document.getElementById("checkout-clear");
const itemsEl = document.getElementById("checkout-items");
const totalEl = document.getElementById("checkout-total");
const taxEl = document.getElementById("checkout-tax");
const cartCountEl = document.getElementById("checkout-cart-count");
const sourceEl = document.getElementById("checkout-source");
const formEl = document.getElementById("checkout-form");
const nameEl = document.getElementById("checkout-customer-name");
const phoneEl = document.getElementById("checkout-customer-phone");
const addressEl = document.getElementById("checkout-customer-address");
const notesEl = document.getElementById("checkout-customer-notes");
const paymentPanelEl = document.getElementById("checkout-payment-panel");
const paymentTitleEl = document.getElementById("checkout-payment-title");
const paymentStatusEl = document.getElementById("checkout-payment-status");
const paymentOrderNumberEl = document.getElementById("checkout-payment-order-number");
const paymentAmountEl = document.getElementById("checkout-payment-amount");
const paymentContentEl = document.getElementById("checkout-payment-content");
const paymentBankEl = document.getElementById("checkout-payment-bank");
const paymentAccountEl = document.getElementById("checkout-payment-account");
const paymentQrEl = document.getElementById("checkout-payment-qr");
const paymentOpenEl = document.getElementById("checkout-payment-open");

function updateMessage(text) {
  if (messageEl) {
    messageEl.textContent = text;
  }
}

const checkoutState = {
  mode: "cart",
  items: [],
  catalog: null,
  orderId: null,
  pollTimer: null,
  couponCode: "",
  discountPercent: 0,
};

function updateTotals() {
  let subtotal = 0;
  if (checkoutState.catalog) {
    const productMap = new Map((checkoutState.catalog.products ?? []).map((product) => [product.id, product]));
    checkoutState.items.forEach((item) => {
      const product = productMap.get(item.productId);
      const unitPrice = Number(product?.salePrice ?? 0);
      subtotal += unitPrice * item.quantity;
    });
  }

  // Calculate discount
  let discount = 0;
  if (checkoutState.discountPercent > 0) {
    discount = Math.round((subtotal * checkoutState.discountPercent) / 100);
  }

  const finalSubtotal = Math.max(subtotal - discount, 0);
  const tax = Math.round(finalSubtotal * 0.10);
  const finalTotal = finalSubtotal + tax;

  // Update elements
  const subtotalEl = document.getElementById("checkout-subtotal");
  if (subtotalEl) {
    subtotalEl.textContent = formatCurrencyVnd(subtotal);
  }

  const discountRow = document.getElementById("discount-row");
  const discountCodeEl = document.getElementById("discount-code");
  const discountValEl = document.getElementById("checkout-discount");

  if (discountRow && discountCodeEl && discountValEl) {
    if (checkoutState.discountPercent > 0) {
      discountCodeEl.textContent = checkoutState.couponCode;
      discountValEl.textContent = `-${formatCurrencyVnd(discount)}`;
      discountRow.classList.remove("hidden");
    } else {
      discountRow.classList.add("hidden");
    }
  }

  if (taxEl) {
    taxEl.textContent = formatCurrencyVnd(tax);
  }

  if (totalEl) {
    totalEl.textContent = formatCurrencyVnd(finalTotal);
  }
}

let catalogPromise = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readQueryItems() {
  const searchParams = new URLSearchParams(window.location.search);
  const productsParam = searchParams.get("products") ?? "";
  const items = [];

  for (const pair of productsParam.split(",")) {
    const [productId, quantityText] = pair.split(":");
    const quantity = Number.parseInt(quantityText ?? "1", 10);
    if (productId && Number.isInteger(quantity) && quantity > 0) {
      items.push({ productId, quantity });
    }
  }

  return items;
}

function getItemCount(items) {
  return items.reduce((total, item) => total + Math.max(Number(item.quantity) || 0, 0), 0);
}

function maybeCanonicalizeCheckoutRoute() {
  if (!window.location.pathname.endsWith("/checkout.html")) {
    return;
  }

  const suffix = window.location.search || "";
  window.history.replaceState({}, "", `${CHECKOUT_ROUTE}${suffix}`);
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetchTrevoPublicCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }

  return catalogPromise;
}

function getCheckoutItems() {
  const queryItems = readQueryItems();
  if (queryItems.length > 0) {
    return {
      mode: "instant",
      items: queryItems,
    };
  }

  return {
    mode: "cart",
    items: getStoredCartItems(),
  };
}

function updateCartCount(count) {
  if (cartCountEl) {
    cartCountEl.textContent = String(count);
  }
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
    node.classList.toggle("hidden", count < 1);
  });
}

function setPrimaryActionLabel(label) {
  if (continueEl) {
    continueEl.textContent = label;
  }

  if (submitEl) {
    submitEl.textContent = label;
  }
}

function setActionDisabled(disabled) {
  if (continueEl instanceof HTMLButtonElement) {
    continueEl.disabled = disabled;
  }

  if (submitEl instanceof HTMLButtonElement) {
    submitEl.disabled = disabled;
  }
}

function setSubmitting(submitting) {
  [continueEl, submitEl, clearEl, nameEl, phoneEl, addressEl, notesEl].forEach((element) => {
    if (
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.disabled = submitting;
    }
  });

  setPrimaryActionLabel(submitting ? "Đang tạo đơn..." : "Tiến hành thanh toán");
}

function stopPolling() {
  if (checkoutState.pollTimer) {
    window.clearInterval(checkoutState.pollTimer);
    checkoutState.pollTimer = null;
  }
}

function hidePaymentPanel() {
  stopPolling();
  checkoutState.orderId = null;
  paymentPanelEl?.classList.add("hidden");
}

function renderEmptyState(mode) {
  itemsEl.innerHTML = `
    <div class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-600">
      <p class="text-lg font-medium text-slate-800">
        ${mode === "instant" ? "Không có sản phẩm hợp lệ" : "Giỏ hàng đang trống"}
      </p>
      <p class="mt-2 text-sm">
        ${mode === "instant"
          ? "Link mua nhanh hiện không còn dữ liệu. Hãy quay lại trang sản phẩm."
          : "Hãy thêm sản phẩm từ catalog Tea Station trước khi tạo đơn."}
      </p>
    </div>
  `;
  totalEl.textContent = formatCurrencyVnd(0);
  setPrimaryActionLabel(mode === "instant" ? "Quay lại sản phẩm" : "Thêm sản phẩm trước");
  setActionDisabled(true);

  if (clearEl instanceof HTMLButtonElement) {
    clearEl.disabled = true;
  }
}

function getProductLimit(product) {
  const stockLimit =
    typeof product?.availableStock === "number" && product.availableStock > 0
      ? product.availableStock
      : MAX_LINE_ITEM_QTY;

  return Math.min(Math.max(stockLimit, 1), MAX_LINE_ITEM_QTY);
}

function renderQuantityControl(item, product, mode) {
  if (mode !== "cart") {
    return `
      <div class="inline-flex h-9 min-w-[70px] items-center justify-center border border-slate-200 bg-white text-sm font-semibold text-slate-700">
        x${item.quantity}
      </div>
    `;
  }

  const limit = getProductLimit(product);
  const disableDec = item.quantity <= 1;
  const disableInc = item.quantity >= limit;
  const buttonClass =
    "inline-flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 font-bold cursor-pointer";

  return `
    <div class="inline-flex items-center border border-slate-200 bg-white rounded overflow-hidden">
      <button
        type="button"
        class="${buttonClass} border-r border-slate-200"
        data-qty-dec="${escapeHtml(item.productId)}"
        ${disableDec ? "disabled" : ""}
        aria-label="Giảm số lượng"
      >-</button>
      <span class="inline-flex h-9 w-10 items-center justify-center text-sm font-bold text-slate-800 select-none">
        ${item.quantity}
      </span>
      <button
        type="button"
        class="${buttonClass} border-l border-slate-200"
        data-qty-inc="${escapeHtml(item.productId)}"
        ${disableInc ? "disabled" : ""}
        aria-label="Tăng số lượng"
      >+</button>
    </div>
  `;
}

function renderItems(items, catalog, mode) {
  const productMap = new Map((catalog.products ?? []).map((product) => [product.id, product]));
  let total = 0;

  const cards = items.map((item) => {
    const product = productMap.get(item.productId);
    const name = product?.name ?? item.productId;
    const imageUrl = resolveImageUrl(product?.imageUrl);
    const unitPrice = Number(product?.salePrice ?? 0);
    const subtotal = unitPrice * item.quantity;
    total += subtotal;

    return `
      <div class="grid grid-cols-1 md:grid-cols-[3.2fr_1.2fr_1.2fr_1.2fr] items-center gap-4 py-6 text-slate-700 border-b border-slate-100 last:border-0">
        <!-- Col 1: Product info (Image, Close button, Title) -->
        <div class="flex items-center">
          ${mode === 'cart' ? `
            <button
              type="button"
              data-remove-item="${escapeHtml(item.productId)}"
              class="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors cursor-pointer mr-3 flex-shrink-0"
              aria-label="Xóa sản phẩm"
            >
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ` : ''}
          <img
            src="${escapeHtml(imageUrl)}"
            alt="${escapeHtml(name)}"
            class="h-16 w-16 rounded object-cover border border-slate-100 flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div class="min-w-0 flex-1 ml-4">
            <h4 class="font-semibold text-slate-800 text-sm md:text-base leading-snug line-clamp-2">${escapeHtml(name)}</h4>
            <p class="text-xs text-slate-400 uppercase tracking-wider mt-1">${escapeHtml(product?.categoryName ?? "Sản phẩm")}</p>
          </div>
        </div>

        <!-- Col 2: Price -->
        <div class="flex justify-between items-center md:justify-end md:pr-4">
          <span class="md:hidden text-xs font-semibold uppercase tracking-wider text-slate-400">Giá:</span>
          <span class="font-medium text-slate-800">${escapeHtml(formatCurrencyVnd(unitPrice))}</span>
        </div>

        <!-- Col 3: Quantity -->
        <div class="flex justify-between items-center md:justify-center">
          <span class="md:hidden text-xs font-semibold uppercase tracking-wider text-slate-400">Số lượng:</span>
          ${renderQuantityControl(item, product, mode)}
        </div>

        <!-- Col 4: Subtotal -->
        <div class="flex justify-between items-center md:justify-end">
          <span class="md:hidden text-xs font-semibold uppercase tracking-wider text-slate-400">Tạm tính:</span>
          <span class="font-bold text-slate-800">${escapeHtml(formatCurrencyVnd(subtotal))}</span>
        </div>
      </div>
    `;
  });

  itemsEl.innerHTML = cards.join("");
  updateTotals();
  setPrimaryActionLabel("Tiến hành thanh toán");
  setActionDisabled(false);

  if (clearEl instanceof HTMLButtonElement) {
    clearEl.disabled = mode !== "cart" || items.length === 0;
  }
}

function renderPaymentState({ order, payment }) {
  if (!paymentPanelEl) {
    return;
  }

  paymentPanelEl.classList.remove("hidden");
  paymentTitleEl.textContent = `Mã QR sẵn sàng cho ${order.orderNumber}`;
  paymentStatusEl.textContent =
    "Quét QR bằng app ngân hàng. Tea Station sẽ tự động cập nhật trạng thái sau khi giao dịch thành công.";
  paymentOrderNumberEl.textContent = order.orderNumber;
  paymentAmountEl.textContent = formatCurrencyVnd(payment.total ?? order.total ?? 0);
  paymentContentEl.textContent = payment.transferContent ?? "-";
  paymentBankEl.textContent = `${payment.bankCode ?? "-"} • ${payment.bankAccount ?? "-"}`;
  paymentAccountEl.textContent = payment.accountName ?? "-";
  paymentQrEl.src = payment.paymentQrUrl;
  paymentOpenEl.href = payment.paymentQrUrl;
  paymentPanelEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function describeOrderStatus(orderStatus) {
  if (!orderStatus) {
    return "Chưa nhận được trạng thái mới từ Trevo.";
  }

  if (orderStatus.paymentStatus === "paid") {
    return "Trevo đã ghi nhận thanh toán thành công. Đơn hàng của bạn đang được xử lý.";
  }

  if (orderStatus.paymentStatus === "failed" || orderStatus.status === "cancelled") {
    return "Đơn hàng đang ở trạng thái thất bại hoặc đã bị hủy. Hãy tạo lại mã QR nếu cần.";
  }

  return "Trevo đang chờ giao dịch SePay. Sau khi chuyển khoản thành công, trạng thái sẽ tự cập nhật.";
}

async function refreshOrderStatus() {
  if (!checkoutState.orderId) {
    return;
  }

  try {
    const status = await getStorefrontOrderStatus(checkoutState.orderId);
    const statusText = describeOrderStatus(status);
    paymentStatusEl.textContent = statusText;

    if (trevoConfig.debug.enabled) {
      paymentStatusEl.textContent += ` [${status.source ?? "unknown"}]`;
    }

    if (status.paymentStatus === "paid") {
      updateMessage("Thanh toán đã được Trevo xác nhận.");
      stopPolling();
      setPrimaryActionLabel("Thanh toán đã xác nhận");
      setActionDisabled(true);
    }

    if (status.paymentStatus === "failed" || status.status === "cancelled") {
      stopPolling();
      setSubmitting(false);
    }
  } catch (error) {
    if (trevoConfig.debug.enabled) {
      paymentStatusEl.textContent =
        error instanceof Error
          ? `Không kiểm tra được trạng thái: ${error.message}`
          : "Không kiểm tra được trạng thái.";
    }
  }
}

function startOrderStatusPolling(orderId) {
  stopPolling();
  checkoutState.orderId = orderId;
  void refreshOrderStatus();
  checkoutState.pollTimer = window.setInterval(() => {
    void refreshOrderStatus();
  }, 5000);
}

async function renderCheckout() {
  maybeCanonicalizeCheckoutRoute();

  const { mode, items } = getCheckoutItems();
  checkoutState.mode = mode;
  checkoutState.items = items;
  updateCartCount(getItemCount(items));
  hidePaymentPanel();

  sourceEl.textContent =
    mode === "instant"
      ? "Nguồn: mua nhanh trực tiếp từ landing page"
      : "Nguồn: giỏ hàng Tea Station";

  if (items.length === 0) {
    updateMessage("Chưa có sản phẩm nào sẵn sàng để đặt hàng.");
    renderEmptyState(mode);
    return;
  }

  updateMessage(
    mode === "instant"
      ? "Bạn đang tạo đơn mua nhanh trực tiếp từ Tea Station."
      : "Kiểm tra giỏ hàng, điều chỉnh số lượng nếu cần, sau đó điền thông tin người nhận."
  );

  try {
    const catalog = await loadCatalog();
    checkoutState.catalog = catalog;
    renderItems(items, catalog, mode);

    if (trevoConfig.debug.enabled && messageEl) {
      messageEl.textContent += ` [API: ${trevoConfig.storefrontApiBaseUrl}]`;
    }
  } catch (error) {
    checkoutState.catalog = null;
    updateMessage(
      error instanceof Error
        ? `Không lấy được dữ liệu Tea Station: ${error.message}`
        : "Không lấy được dữ liệu Tea Station."
    );
    renderEmptyState(mode);
  }
}

function updateCartItem(productId, nextQuantity) {
  if (checkoutState.mode !== "cart") {
    return;
  }

  setCartItemQuantity(productId, nextQuantity);
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (checkoutState.items.length === 0) {
    return;
  }

  setSubmitting(true);
  updateMessage("Tea Station đang tạo đơn và xin mã QR từ Trevo...");

  try {
    const result = await createStorefrontCheckout({
      customerName: nameEl.value.trim(),
      customerPhone: phoneEl.value.trim(),
      customerAddress: addressEl.value.trim(),
      notes: notesEl.value.trim(),
      promotionCode: checkoutState.couponCode || undefined,
      items: checkoutState.items,
    });

    renderPaymentState(result);
    updateMessage(`Đã tạo đơn ${result.order.orderNumber}. Hãy quét QR để thanh toán.`);
    setPrimaryActionLabel("Đang chờ thanh toán");
    setActionDisabled(true);

    if (clearEl instanceof HTMLButtonElement) {
      clearEl.disabled = true;
    }

    if (checkoutState.mode === "cart") {
      checkoutState.orderId = result.order.id;
      clearCart();
    }

    startOrderStatusPolling(result.order.id);
    setSubmitting(false);
  } catch (error) {
    updateMessage(
      error instanceof Error
        ? `Không tạo được đơn: ${error.message}`
        : "Không tạo được đơn."
    );
    setSubmitting(false);
  }
}

function attachEvents() {
  clearEl?.addEventListener("click", () => {
    clearCart();
  });

  itemsEl?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const removeProductId = target.dataset.removeItem?.trim();
    if (removeProductId) {
      removeFromCart(removeProductId);
      return;
    }

    const decreaseProductId = target.dataset.qtyDec?.trim();
    if (decreaseProductId) {
      const current = checkoutState.items.find((item) => item.productId === decreaseProductId);
      if (!current) {
        return;
      }

      updateCartItem(decreaseProductId, current.quantity - 1);
      return;
    }

    const increaseProductId = target.dataset.qtyInc?.trim();
    if (increaseProductId) {
      const current = checkoutState.items.find((item) => item.productId === increaseProductId);
      const product = checkoutState.catalog?.products?.find((item) => item.id === increaseProductId);
      if (!current) {
        return;
      }

      const limit = getProductLimit(product);
      updateCartItem(increaseProductId, Math.min(current.quantity + 1, limit));
    }
  });

  // Coupon selection & input handlers
  const couponInput = document.getElementById("coupon-input");
  const applyCouponBtn = document.getElementById("apply-coupon-btn");
  const couponMessage = document.getElementById("coupon-message");

  const VALID_COUPONS = {
    "STATION5": 5,
    "TEASTATION10": 10,
    "FREESHIP": 0
  };

  function applyCoupon(code) {
    const normalizedCode = String(code ?? "").trim().toUpperCase();
    if (normalizedCode in VALID_COUPONS) {
      checkoutState.couponCode = normalizedCode;
      checkoutState.discountPercent = VALID_COUPONS[normalizedCode];
      
      if (couponMessage) {
        couponMessage.textContent = `Áp dụng thành công mã ${normalizedCode} (Giảm ${checkoutState.discountPercent}%).`;
        couponMessage.className = "text-xs mt-1.5 font-medium text-emerald-600 block";
      }
      if (couponInput) {
        couponInput.value = normalizedCode;
      }
      updateTotals();
    } else if (normalizedCode !== "") {
      if (couponMessage) {
        couponMessage.textContent = "Mã giảm giá không hợp lệ.";
        couponMessage.className = "text-xs mt-1.5 font-medium text-rose-600 block";
      }
    }
  }

  document.querySelectorAll("[data-coupon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.coupon;
      applyCoupon(code);
    });
  });

  applyCouponBtn?.addEventListener("click", () => {
    const code = couponInput?.value;
    applyCoupon(code);
  });

  formEl?.addEventListener("submit", (event) => {
    void handleCheckoutSubmit(event);
  });

  subscribeToCartUpdates(() => {
    if (checkoutState.orderId) {
      updateCartCount(getCartItemCount());
      return;
    }

    if (checkoutState.mode !== "cart" && readQueryItems().length > 0) {
      return;
    }

    void renderCheckout();
  });

  bootstrapCartState();
}

attachEvents();
void renderCheckout();
