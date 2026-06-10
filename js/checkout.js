import { trevoConfig } from "./trevo-config.js";
import { buildTrevoCheckoutUrl, fetchTrevoPublicCatalog } from "./trevo-api.js";

const messageEl = document.getElementById("checkout-message");
const continueEl = document.getElementById("checkout-continue");

function readCartItems() {
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

async function init() {
  const items = readCartItems();

  if (items.length === 0) {
    messageEl.textContent = "Chua co san pham nao duoc chon.";
    continueEl.textContent = "Ve trang san pham";
    continueEl.href = "./products.html";
    return;
  }

  try {
    const catalog = await fetchTrevoPublicCatalog();
    const productNameById = new Map((catalog.products ?? []).map((product) => [product.id, product.name]));
    const summary = items
      .map((item) => `${productNameById.get(item.productId) ?? item.productId} x${item.quantity}`)
      .join(", ");
    const targetUrl = buildTrevoCheckoutUrl(items);

    messageEl.textContent = `Dang chuyen ${summary} sang Trevo Public Order.`;
    if (trevoConfig.debug.enabled) {
      messageEl.textContent += ` [${trevoConfig.frontendBaseUrl}/${trevoConfig.orgSlug}/order]`;
    }
    continueEl.href = targetUrl;
    window.setTimeout(() => {
      window.location.replace(targetUrl);
    }, 700);
  } catch (error) {
    messageEl.textContent =
      error instanceof Error
        ? `Khong lay duoc du lieu Trevo: ${error.message}`
        : "Khong lay duoc du lieu Trevo.";
    continueEl.textContent = "Thu lai";
  }
}

init();
