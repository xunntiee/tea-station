import {
  bootstrapCartState,
  clearCart,
  getCartItemCount,
  getStoredCartItems,
  removeFromCart,
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

const messageEl = document.getElementById("checkout-message");
const continueEl = document.getElementById("checkout-continue");
const submitEl = document.getElementById("checkout-submit");
const clearEl = document.getElementById("checkout-clear");
const itemsEl = document.getElementById("checkout-items");
const totalEl = document.getElementById("checkout-total");
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

const checkoutState = {
  mode: "cart",
  items: [],
  catalog: null,
  orderId: null,
  pollTimer: null,
};

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

function updateCartCount(count = getCartItemCount()) {
  if (cartCountEl) {
    cartCountEl.textContent = String(count);
  }
}

function setPrimaryActionLabel(label) {
  if (continueEl) {
    continueEl.textContent = label;
  }

  if (submitEl) {
    submitEl.textContent = label;
  }
}

function setSubmitting(submitting) {
  [continueEl, submitEl, clearEl, nameEl, phoneEl, addressEl, notesEl].forEach((element) => {
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.disabled = submitting;
    }
  });

  if (submitting) {
    setPrimaryActionLabel("Đang tạo đơn...");
  } else {
    setPrimaryActionLabel("Tạo đơn & lấy QR");
  }
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
  setPrimaryActionLabel("Quay lại sản phẩm");
  if (continueEl instanceof HTMLButtonElement) {
    continueEl.disabled = true;
  }
  if (submitEl instanceof HTMLButtonElement) {
    submitEl.disabled = true;
  }
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

    const removeButton =
      mode === "cart"
        ? `
          <button
            type="button"
            data-remove-item="${escapeHtml(item.productId)}"
            class="inline-flex items-center justify-center rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Xoa
          </button>
        `
        : "";

    const stockHint =
      typeof product?.availableStock === "number"
        ? ` • Tồn: ${escapeHtml(product.availableStock)}`
        : "";

    return `
      <article class="flex flex-col gap-4 rounded-[1.5rem] border border-black/5 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <img
          src="${escapeHtml(imageUrl)}"
          alt="${escapeHtml(name)}"
          class="h-28 w-full rounded-[1.25rem] object-cover sm:w-28"
          loading="lazy"
        />
        <div class="flex-1">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
            ${escapeHtml(product?.categoryName ?? "Sản phẩm")}
          </p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">${escapeHtml(name)}</h3>
          <p class="mt-2 text-sm text-slate-500">
            Số lượng: <strong class="text-slate-700">${item.quantity}</strong>${stockHint}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Đơn giá: ${escapeHtml(formatCurrencyVnd(unitPrice))}
            </span>
            <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Tạm tính: ${escapeHtml(formatCurrencyVnd(subtotal))}
            </span>
            ${removeButton}
          </div>
        </div>
      </article>
    `;
  });

  itemsEl.innerHTML = cards.join("");
  totalEl.textContent = formatCurrencyVnd(total);
}

function renderPaymentState({ order, payment }) {
  if (!paymentPanelEl) {
    return;
  }

  paymentPanelEl.classList.remove("hidden");
  paymentTitleEl.textContent = `Mã QR sẵn sàng cho ${order.orderNumber}`;
  paymentStatusEl.textContent =
    "Quét QR bằng app ngân hàng. Trevo sẽ tự động cập nhật trạng thái sau khi giao dịch thành công.";
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
      messageEl.textContent = "Thanh toán đã được Trevo xác nhận.";
      stopPolling();
      setPrimaryActionLabel("Thanh toán đã xác nhận");
      if (continueEl instanceof HTMLButtonElement) {
        continueEl.disabled = true;
      }
      if (submitEl instanceof HTMLButtonElement) {
        submitEl.disabled = true;
      }
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
  const { mode, items } = getCheckoutItems();
  checkoutState.mode = mode;
  checkoutState.items = items;
  updateCartCount();
  hidePaymentPanel();

  sourceEl.textContent =
    mode === "instant"
      ? "Nguồn: mua nhanh từ landing page"
      : "Nguồn: giỏ hàng Tea Station";

  if (items.length === 0) {
    messageEl.textContent = "Chưa có sản phẩm nào sẵn sàng để đặt hàng.";
    renderEmptyState(mode);
    return;
  }

  messageEl.textContent =
    mode === "instant"
      ? "Bạn đang tạo đơn mua nhanh trực tiếp từ Tea Station."
      : "Kiểm tra giỏ hàng, điền thông tin người nhận, sau đó tạo QR thanh toán.";

  try {
    const catalog = await fetchTrevoPublicCatalog();
    checkoutState.catalog = catalog;
    renderItems(items, catalog, mode);
    setSubmitting(false);

    if (trevoConfig.debug.enabled) {
      messageEl.textContent += ` [API: ${trevoConfig.storefrontApiBaseUrl}]`;
    }
  } catch (error) {
    checkoutState.catalog = null;
    messageEl.textContent =
      error instanceof Error
        ? `Không lấy được dữ liệu Tea Station: ${error.message}`
        : "Không lấy được dữ liệu Tea Station.";
    renderEmptyState(mode);
  }
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();

  if (checkoutState.items.length === 0) {
    return;
  }

  setSubmitting(true);
  messageEl.textContent = "Tea Station đang tạo đơn và xin mã QR từ Trevo...";

  try {
    const result = await createStorefrontCheckout({
      customerName: nameEl.value.trim(),
      customerPhone: phoneEl.value.trim(),
      customerAddress: addressEl.value.trim(),
      notes: notesEl.value.trim(),
      items: checkoutState.items,
    });

    renderPaymentState(result);
    messageEl.textContent = `Đã tạo đơn ${result.order.orderNumber}. Hãy quét QR để thanh toán.`;

    if (checkoutState.mode === "cart") {
      clearCart();
    }

    startOrderStatusPolling(result.order.id);
    setSubmitting(false);
  } catch (error) {
    messageEl.textContent =
      error instanceof Error
        ? `Không tạo được đơn: ${error.message}`
        : "Không tạo được đơn.";
    setSubmitting(false);
  }
}

function attachEvents() {
  clearEl?.addEventListener("click", () => {
    clearCart();
    renderCheckout();
  });

  itemsEl?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-remove-item]") : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const productId = target.dataset.removeItem?.trim();
    if (!productId) {
      return;
    }

    removeFromCart(productId);
    renderCheckout();
  });

  formEl?.addEventListener("submit", (event) => {
    void handleCheckoutSubmit(event);
  });

  subscribeToCartUpdates(({ count }) => updateCartCount(count));
  bootstrapCartState();
}

attachEvents();
renderCheckout();
