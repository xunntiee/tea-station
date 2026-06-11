import { partnerLogos, partnerLogoBasePath } from "./data.js";
import {
  addToCart,
  bootstrapCartState,
  getCartItemCount,
  subscribeToCartUpdates,
} from "./trevo-cart.js";
import { trevoConfig } from "./trevo-config.js";
import {
  fetchTrevoPublicCatalog,
  formatCurrencyVnd,
  normalizeProductCategory,
  resolveImageUrl,
} from "./trevo-api.js";

let trevoCatalogPromise = null;
const PRODUCTS_ROUTE = "/products";
const CHECKOUT_ROUTE = "/checkout";

function normalizeRouteCategory(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProductsUrl(category) {
  const normalizedCategory = normalizeRouteCategory(category);
  return normalizedCategory
    ? `${PRODUCTS_ROUTE}/${encodeURIComponent(normalizedCategory)}`
    : PRODUCTS_ROUTE;
}

function buildCheckoutUrl(productsValue) {
  if (!productsValue) {
    return CHECKOUT_ROUTE;
  }

  return `${CHECKOUT_ROUTE}?products=${encodeURIComponent(productsValue)}`;
}

function readCurrentCategoryFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/products\/([^/?#]+)$/i);
  if (pathMatch?.[1]) {
    return normalizeRouteCategory(decodeURIComponent(pathMatch[1]));
  }

  if (window.location.search.includes("filter-category=")) {
    return normalizeRouteCategory(
      new URLSearchParams(window.location.search).get("filter-category"),
    );
  }

  return "all";
}

async function loadTrevoCatalog() {
  if (!trevoCatalogPromise) {
    trevoCatalogPromise = fetchTrevoPublicCatalog().catch((error) => {
      trevoCatalogPromise = null;
      throw error;
    });
  }

  return trevoCatalogPromise;
}

function applyDeferredBackground(node) {
  if (!(node instanceof HTMLElement) || node.dataset.bgLoaded === "1") {
    return;
  }

  const backgroundUrl = node.dataset.bg?.trim();
  if (!backgroundUrl) {
    return;
  }

  node.style.backgroundImage = `url(${backgroundUrl})`;
  node.dataset.bgLoaded = "1";
}

function applyDeferredVideo(node) {
  if (!(node instanceof HTMLVideoElement) || node.dataset.videoLoaded === "1") {
    return;
  }

  const sourceNodes = Array.from(node.querySelectorAll("source[data-src]"));
  sourceNodes.forEach((sourceNode) => {
    const sourceUrl = sourceNode.dataset.src?.trim();
    if (!sourceUrl) {
      return;
    }

    sourceNode.src = sourceUrl;
    sourceNode.removeAttribute("data-src");
  });

  node.load();
  node.dataset.videoLoaded = "1";

  if (node.autoplay) {
    node.play().catch(() => {
      // Ignore autoplay restrictions.
    });
  }
}

function initDeferredMedia() {
  const deferredNodes = [
    ...document.querySelectorAll("[data-bg]"),
    ...document.querySelectorAll("[data-deferred-video]"),
  ];

  if (deferredNodes.length === 0) {
    return;
  }

  const loadNode = (node) => {
    if (node instanceof HTMLVideoElement) {
      applyDeferredVideo(node);
      return;
    }

    applyDeferredBackground(node);
  };

  if (!("IntersectionObserver" in window)) {
    deferredNodes.forEach(loadNode);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        loadNode(entry.target);
        currentObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "240px 0px" },
  );

  deferredNodes.forEach((node) => observer.observe(node));
}

/* ===============
    Navigation
=================== */
$(function () {
  $(".navbar").hidescroll();

  const toggleBtn = $("#toggle_btn");
  const dropdownMenu = $(".dropdown-menu");

  toggleBtn.click(() => {
    dropdownMenu.toggleClass("open");
  });
});

/* ===============
    Partner Logos
=================== */
$(function () {
  const container = document.getElementById("partner-logo-list");
  if (!container) {
    return;
  }

  for (let i = 0; i < 2; i += 1) {
    partnerLogos.forEach((logo) => {
      const img = document.createElement("img");
      img.src = partnerLogoBasePath + logo.fileName;
      img.alt = logo.alt;
      img.classList.add("logo-ticker-image");
      container.appendChild(img);
    });
  }
});

/* ===============
    Products Tabs
=================== */
$(function () {
  if (!$("#products-tabs").length) {
    return;
  }

  $("li:first").addClass("activeTab");

  $("li").on("click", function () {
    $("li").removeClass("activeTab");
    $('div[id="products-tabs"] ul .r-tabs-state-active').addClass("activeTab");
  });

  $("#products-tabs").responsiveTabs({
    animation: "fade",
    duration: 200,
  });
});

/* ================
        Stats
=================== */
$(function () {
  if (!window.counterUp?.default) {
    return;
  }

  const counterUp = window.counterUp.default;

  const callback = (entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting && !el.classList.contains("is-visible")) {
        counterUp(el, {
          duration: 2000,
          delay: 16,
        });
        el.classList.add("is-visible");
      }
    });
  };

  const observer = new IntersectionObserver(callback, { threshold: 1 });
  document.querySelectorAll(".counter").forEach((node) => observer.observe(node));
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function buildProductDescription(product) {
  if (product.shortDescription) return product.shortDescription;
  if (product.description) return product.description;

  const parts = [];

  if (product.categoryName) {
    parts.push(`Danh mục: ${product.categoryName}`);
  }

  if (product.sku) {
    parts.push(`SKU: ${product.sku}`);
  }

  parts.push(
    product.availableStock > 0
      ? `Còn ${product.availableStock} sản phẩm`
      : "Tạm hết hàng",
  );

  return parts.join(" | ");
}

function getBestSellerPitch(product) {
  const categoryKey = normalizeProductCategory(product.categoryName);

  switch (categoryKey) {
    case "matcha":
      return "Hợp cho năng lượng sáng, tập trung và làm việc của ngày.";
    case "oolong":
      return "Hương vị cân bằng, thơm sâu và dễ thưởng thức mọi lúc.";
    case "whitetea":
      return "Nhẹ nhàng, tinh tế, phù hợp nghỉ ngơi và thư giãn.";
    case "blacktea":
      return "Đậm vị, mạnh mẽ và hợp với người thích hương vị rõ nét.";
    case "herbal":
      return "Sự thư giãn tuyệt đối từ thiên nhiên, không chứa caffeine.";
    default:
      return "Lựa chọn nổi bật trong catalog Tea Station.";
  }
}

function renderDebugMeta(product) {
  if (!trevoConfig.debug.enabled) {
    return "";
  }

  const sku = product.sku ? escapeHtml(product.sku) : "none";
  const id = product.id ? escapeHtml(product.id) : "none";

  return `
    <div class="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[11px] leading-5 text-slate-500">
      <p>ID: <code class="font-mono text-slate-700">${id}</code></p>
      <p>SKU: <code class="font-mono text-slate-700">${sku}</code></p>
    </div>
  `;
}

function renderAddToCartButton(product, variant = "light") {
  const quantity = Math.max(product.minOrderQty ?? 1, 1);
  const disabledClass = product.availableStock > 0 ? "" : "pointer-events-none opacity-50";
  const palette =
    variant === "dark"
      ? "border-white/30 text-white hover:bg-white/10"
      : "border-slate-300 text-slate-700 hover:bg-slate-50";

  return `
    <button
      type="button"
      class="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${palette} ${disabledClass}"
      data-add-to-cart
      data-product-id="${escapeHtml(product.id)}"
      data-product-qty="${quantity}"
      ${product.availableStock > 0 ? "" : "disabled"}
    >Thêm vào giỏ</button>
  `;
}

const featuredCategoryOrder = ["matcha", "oolong", "whitetea", "blacktea", "herbal"];

function matchesMerchandisingRule(product, rule) {
  if (!rule) {
    return false;
  }

  const productId = String(product.id ?? "");
  const normalizedSku = normalizeSearchText(product.sku);
  const normalizedName = normalizeSearchText(product.name);
  const normalizedCategory = normalizeProductCategory(product.categoryName);

  if (
    Array.isArray(rule.preferredIds) &&
    rule.preferredIds.some((value) => String(value) === productId)
  ) {
    return true;
  }

  if (
    Array.isArray(rule.preferredSkus) &&
    rule.preferredSkus.some(
      (value) => normalizeSearchText(value) === normalizedSku,
    )
  ) {
    return true;
  }

  if (
    Array.isArray(rule.preferredNames) &&
    rule.preferredNames.some(
      (value) => normalizeSearchText(value) === normalizedName,
    )
  ) {
    return true;
  }

  if (
    Array.isArray(rule.nameIncludes) &&
    rule.nameIncludes.some((value) =>
      normalizedName.includes(normalizeSearchText(value)),
    )
  ) {
    return true;
  }

  return Boolean(rule.category && normalizedCategory === rule.category);
}

function selectMerchandisedProducts(products, rules, fallbackLimit = 4) {
  const picked = [];
  const pickedIds = new Set();

  if (Array.isArray(rules) && rules.length > 0) {
    for (const rule of rules) {
      const match = products.find((product) => {
        if (pickedIds.has(product.id)) {
          return false;
        }

        return matchesMerchandisingRule(product, rule);
      });

      if (match) {
        picked.push({ product: match, config: rule });
        pickedIds.add(match.id);
      }
    }
  }

  const limit = Math.max(
    fallbackLimit,
    Array.isArray(rules) ? rules.length : 0,
  );

  for (const product of products) {
    if (picked.length >= limit) {
      break;
    }

    if (pickedIds.has(product.id)) {
      continue;
    }

    picked.push({ product, config: null });
    pickedIds.add(product.id);
  }

  return picked.slice(0, limit);
}

function selectFeaturedProducts(products, rules) {
  const fallbackRules = featuredCategoryOrder.map((category) => ({ category }));
  const activeRules =
    Array.isArray(rules) && rules.length > 0 ? rules : fallbackRules;

  return selectMerchandisedProducts(
    products,
    activeRules,
    featuredCategoryOrder.length,
  );
}

function renderProductCard(product) {
  const categoryKey = normalizeProductCategory(product.categoryName);
  const currentPrice = formatCurrencyVnd(product.salePrice);
  const listPrice =
    Number(product.listPrice ?? 0) > Number(product.salePrice ?? 0)
      ? `<p class="mt-1 text-xs text-white/70 line-through">${escapeHtml(formatCurrencyVnd(product.listPrice))}</p>`
      : "";
  const stockBadge =
    product.availableStock > 0
      ? `<span class="inline-flex rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Còn hàng</span>`
      : `<span class="inline-flex rounded-full bg-rose-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Hết hàng</span>`;

  return `
    <article
      data-filterable
      data-filter-category="${escapeHtml(categoryKey)}"
      class="relative col-span-3 overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl md:col-span-3 lg:col-span-4"
    >
      <div class="relative aspect-[4/5] overflow-hidden bg-[#f7f2eb]">
        <img
          src="${escapeHtml(resolveImageUrl(product.imageUrl))}"
          alt="${escapeHtml(product.name)}"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div class="absolute left-4 top-4">${stockBadge}</div>
      </div>

      <div class="space-y-3 p-5">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">${escapeHtml(product.categoryName ?? "Sản phẩm")}</p>
          <h3 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(product.name)}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(buildProductDescription(product))}</p>
          ${renderDebugMeta(product)}
        </div>

        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-lg font-semibold text-slate-900">${escapeHtml(currentPrice)}</p>
            ${listPrice}
          </div>
          <div class="flex flex-col items-end gap-2">
            <a
              href="${buildCheckoutUrl(`${product.id}:${Math.max(product.minOrderQty ?? 1, 1)}`)}"
              class="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 ${product.availableStock > 0 ? "" : "pointer-events-none opacity-50"}"
              ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
            >
              Đặt ngay
            </a>
            ${renderAddToCartButton(product)}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProductCard(selection) {
  const { product, config } = selection;
  const categoryKey = normalizeProductCategory(product.categoryName);
  const targetUrl = buildProductsUrl(categoryKey);
  const quantity = Math.max(product.minOrderQty ?? 1, 1);
  const price = formatCurrencyVnd(product.salePrice);
  const stockLabel =
    product.availableStock > 0 ? `Còn ` : "Tạm hết hàng";
  const eyebrow = config?.eyebrow ?? "Tea Station Selection";
  const ctaLabel = config?.ctaLabel ?? "Đặt ngay";

  return `
    <article class="group overflow-hidden rounded-[2rem] border border-p-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <a href="${targetUrl}" class="block">
        <div class="relative aspect-[4/5] overflow-hidden bg-p-50">
          <img
            src="${escapeHtml(resolveImageUrl(product.imageUrl))}"
            alt="${escapeHtml(product.name)}"
            class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div class="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-p-700 shadow-sm">
            ${escapeHtml(product.categoryName ?? "Sản phẩm")}
          </div>
        </div>
      </a>
      <div class="space-y-3 p-5">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-p-700">${escapeHtml(eyebrow)}</p>
          <h3 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(product.name)}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(buildProductDescription(product))}</p>
        </div>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-lg font-semibold text-slate-900">${escapeHtml(price)}</p>
            <p class="text-xs text-slate-500">${escapeHtml(stockLabel)}</p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <a
              href="${buildCheckoutUrl(`${product.id}:${quantity}`)}"
              class="inline-flex items-center justify-center rounded-full bg-p-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-p-700 ${product.availableStock > 0 ? "" : "pointer-events-none opacity-50"}"
              ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
            >
              ${escapeHtml(ctaLabel)}
            </a>
            ${renderAddToCartButton(product)}
          </div>
        </div>
        <a href="${targetUrl}" class="inline-flex text-sm font-medium text-p-700 transition hover:text-p-900">
          Xem theo danh mục
        </a>
      </div>
    </article>
  `;
}

function renderBestSellerSlide(selection) {
  const { product, config } = selection;
  const categoryLabel = product.categoryName ?? "Sản phẩm";
  const price = formatCurrencyVnd(product.salePrice);
  const stockLabel =
    product.availableStock > 0 ? `Còn ` : "Tạm hết hàng";
  const quantity = Math.max(product.minOrderQty ?? 1, 1);
  const pitch = config?.pitch ?? getBestSellerPitch(product);
  const eyebrow = config?.eyebrow ?? "Best seller";
  const ctaLabel = config?.ctaLabel ?? "Đặt ngay";

  return `
    <div class="!flex flex-col lg:flex-row items-center justify-between gap-10">
      <div class="flex-1 best-product--left">
        <div class="best-product-info">
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-p-700">${escapeHtml(eyebrow)} - ${escapeHtml(categoryLabel)}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(pitch)} ${escapeHtml(buildProductDescription(product))}</p>
          ${renderDebugMeta(product)}
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <span class="rounded-full bg-p-50 px-3 py-1 text-xs font-semibold text-p-900">${escapeHtml(price)}</span>
          <span class="rounded-full bg-p-50 px-3 py-1 text-xs font-semibold text-p-900">${escapeHtml(stockLabel)}</span>
          <span class="rounded-full bg-p-50 px-3 py-1 text-xs font-semibold text-p-900">${escapeHtml(categoryLabel)}</span>
        </div>

        <div class="mt-8">
          <div class="flex flex-wrap gap-3">
            <a
              class="btn"
              href="${buildCheckoutUrl(`${product.id}:${quantity}`)}"
              ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
            >
              ${escapeHtml(ctaLabel)}
            </a>
            ${renderAddToCartButton(product, "dark")}
          </div>
        </div>
      </div>

      <div class="flex-1 flex justify-center lg:justify-end">
        <img
          src="${escapeHtml(resolveImageUrl(product.imageUrl))}"
          alt="${escapeHtml(product.name)}"
          class="w-full max-w-[600px] h-[250px] md:h-[70vh] max-h-[700px] object-cover md:rounded-tl-[80px] md:rounded-bl-[80px]"
          loading="lazy"
        />
      </div>
    </div>
  `;
}

function setActiveFilterLink() {
  const filterLinks = document.querySelectorAll("#allProduct-filters a");
  if (filterLinks.length === 0) {
    return "all";
  }

  const category = readCurrentCategoryFromLocation();

  filterLinks.forEach((link) => link.classList.remove("activeFilter"));
  
  const activeLink = document.getElementById(`f-${category}`) || document.getElementById("f-all");
  if (activeLink) {
    activeLink.classList.add("activeFilter");
  }

  return category;
}

function applyProductFilter(category) {
  const items = document.querySelectorAll("[data-filterable]");
  items.forEach((item) => {
    const productCategory = normalizeRouteCategory(item.dataset.filterCategory);
    const shouldShow = category === "all" || productCategory === category;
    item.classList.toggle("hidden", !shouldShow);
  });
}

function attachFilterHandlers() {
  const filterLinks = document.querySelectorAll("#allProduct-filters a");
  filterLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      const nextUrl = new URL(link.href, window.location.origin);
      window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);

      const category = setActiveFilterLink();
      applyProductFilter(category);
    });
  });
  
  window.addEventListener("popstate", () => {
    const category = setActiveFilterLink();
    applyProductFilter(category);
  });
}

function renderProductState(container, html) {
  container.innerHTML = `
    <div class="col-span-12 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-slate-600">
      ${html}
    </div>
  `;
}

function renderTrevoSectionState(container, html) {
  container.innerHTML = `
    <div class="col-span-12 rounded-[1.75rem] border border-dashed border-p-200 bg-p-50 px-6 py-12 text-center text-slate-600">
      ${html}
    </div>
  `;
}

function renderBestSellerState(container, html) {
  container.innerHTML = `
    <div class="rounded-[2rem] border border-dashed border-p-200 bg-white/85 px-6 py-16 text-center text-slate-600">
      ${html}
    </div>
  `;
}

function mountCatalogDebugPanel(container, products) {
  if (!trevoConfig.debug.enabled || !container.parentElement) {
    return;
  }

  document.getElementById("trevo-debug-panel")?.remove();

  const productRows = products
    .map((product) => {
      const category = product.categoryName ?? "Sản phẩm";
      const sku = product.sku ?? "none";
      return `<li><code class="font-mono text-slate-700">${escapeHtml(product.id)}</code> - <code class="font-mono text-slate-700">${escapeHtml(sku)}</code> - ${escapeHtml(product.name)} - ${escapeHtml(category)}</li>`;
    })
    .join("");

  const panel = document.createElement("section");
  panel.id = "trevo-debug-panel";
  panel.className =
    "mb-6 rounded-[1.5rem] border border-amber-300 bg-amber-50/90 px-5 py-4 text-left text-sm text-slate-700 shadow-sm";
  panel.innerHTML = `
    <p class="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Trevo Debug</p>
    <h3 class="mt-2 text-lg font-semibold text-slate-900">Catalog inspector đang bật</h3>
    <p class="mt-2 leading-6">
      Org: <code class="font-mono">${escapeHtml(trevoConfig.orgSlug)}</code><br />
      Tea Station API: <code class="font-mono break-all">${escapeHtml(trevoConfig.storefrontApiBaseUrl)}</code><br />
      Trevo API: <code class="font-mono break-all">${escapeHtml(trevoConfig.trevoApiBaseUrl)}</code><br />
      Frontend: <code class="font-mono break-all">${escapeHtml(trevoConfig.frontendBaseUrl)}</code>
    </p>
    <p class="mt-3 text-xs leading-5 text-slate-600">
      Copy SKU hoặc ID bên dưới rồi dán vào <code class="font-mono">preferredSkus</code> hoac <code class="font-mono">preferredIds</code> trong <code class="font-mono">js/trevo-config.js</code>.
    </p>
    <ol class="mt-4 list-decimal space-y-1 pl-5 text-xs leading-5">
      ${productRows}
    </ol>
  `;

  container.parentElement.insertBefore(panel, container);

  console.table(
    products.map((product) => ({
      id: product.id,
      sku: product.sku ?? "",
      name: product.name,
      category: product.categoryName ?? "",
      salePrice: product.salePrice,
      availableStock: product.availableStock,
    })),
  );
}

function updateCartBadges(count = getCartItemCount()) {
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
    node.classList.toggle("hidden", count < 1);
  });

  document.querySelectorAll("[data-cart-link]").forEach((node) => {
    const label = count > 0 ? `Gio hang (${count})` : "Gio hang";
    node.setAttribute("aria-label", label);
    node.setAttribute("title", label);
  });

  document.querySelectorAll("[data-cart-label]").forEach((node) => {
    node.textContent = count > 0 ? `Gio hang (${count})` : "Gio hang";
  });
}

function attachCartHandlers() {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-add-to-cart]") : null;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const productId = target.dataset.productId?.trim();
    const quantity = Number.parseInt(target.dataset.productQty ?? "1", 10);
    if (!productId) {
      return;
    }

    addToCart(productId, Number.isInteger(quantity) && quantity > 0 ? quantity : 1);
    const originalText = target.textContent;
    target.textContent = "Đã thêm";
    window.setTimeout(() => {
      target.textContent = originalText ?? "Thêm vào giỏ";
    }, 1200);
  });

  updateCartBadges();
  subscribeToCartUpdates(({ count }) => updateCartBadges(count));
  bootstrapCartState();
}

/* ================
  All Products
=================== */
$(async function () {
  const container = document.getElementById("product-items--container");
  if (!container) {
    return;
  }

  setActiveFilterLink();
  renderProductState(container, "<p>Đang tải sản phẩm từ Tea Station...</p>");

  try {
    const catalog = await loadTrevoCatalog();
    const products = Array.isArray(catalog?.products) ? catalog.products : [];

    if (products.length === 0) {
      renderProductState(
        container,
        "<p class='text-lg font-medium text-slate-800'>Chưa có sản phẩm công khai</p><p class='mt-2 text-sm'>Hãy thêm sản phẩm vào org tea-store trong Trevo rồi quay lại.</p>",
      );
      return;
    }

    mountCatalogDebugPanel(container, products);
    container.innerHTML = products.map(renderProductCard).join("");

    const category = setActiveFilterLink();
    applyProductFilter(category);
    attachFilterHandlers();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không kết nối được tới Tea Station API.";

    renderProductState(
      container,
      `<p class="text-lg font-medium text-slate-800">Không tải được sản phẩm</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
    );
  }
});

/* ================
   Homepage Trevo Preview
=================== */
$(async function () {
  const container = document.getElementById("home-trevo-featured-products");
  if (!container) {
    return;
  }

  renderTrevoSectionState(container, "<p>Đang tải sản phẩm nổi bật từ Tea Station...</p>");

  try {
    const catalog = await loadTrevoCatalog();
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const featuredProducts = selectFeaturedProducts(
      products,
      trevoConfig.merchandising?.homepageFeatured,
    );

    if (featuredProducts.length === 0) {
      renderTrevoSectionState(
        container,
        "<p class='text-lg font-medium text-slate-800'>Chưa có sản phẩm nổi bật công khai</p><p class='mt-2 text-sm'>Hãy bổ sung sản phẩm vào org tea-store trong Trevo.</p>",
      );
      return;
    }

    container.innerHTML = featuredProducts.map(renderFeaturedProductCard).join("");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không kết nối được tới Tea Station API.";

    renderTrevoSectionState(
      container,
      `<p class="text-lg font-medium text-slate-800">Không tải được sản phẩm noi bat</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
    );
  }
});

/* ================
   Best Sellers
=================== */
$(async function () {
  const slider = document.querySelector(".slider");
  if (!slider) {
    return;
  }

  renderBestSellerState(slider, "<p>Đang tải sản phẩm bán chạy từ Tea Station...</p>");

  try {
    const catalog = await loadTrevoCatalog();
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const bestSellers = selectFeaturedProducts(
      products,
      trevoConfig.merchandising?.bestSellerCarousel,
    );

    if (bestSellers.length === 0) {
      renderBestSellerState(
        slider,
        "<p class='text-lg font-medium text-slate-800'>Chưa có sản phẩm nổi bật</p><p class='mt-2 text-sm'>Hãy cập nhật sản phẩm public trong org tea-store.</p>",
      );
      return;
    }

    slider.innerHTML = bestSellers.map(renderBestSellerSlide).join("");

    if ($.fn.slick) {
      $(slider).slick({
        autoplay: true,
        dots: true,
        arrows: false,
        adaptiveHeight: true,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không kết nối được tới Tea Station API.";

    renderBestSellerState(
      slider,
      `<p class="text-lg font-medium text-slate-800">Không tải được sản phẩm ban chay</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
    );
  }
});

/* ================
  AOS Animation
=================== */
$(function () {
  if (!window.AOS) {
    return;
  }

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const isSmallScreen = window.innerWidth < 768;

  window.AOS.init({
    disable: Boolean(prefersReducedMotion || isSmallScreen),
    startEvent: "DOMContentLoaded",
    initClassName: "aos-init",
    animatedClassName: "aos-animate",
    useClassNames: false,
    disableMutationObserver: false,
    debounceDelay: 50,
    throttleDelay: 99,
    offset: 100,
    delay: 50,
    duration: 700,
    easing: "ease-in-out",
    once: true,
    mirror: false,
    anchorPlacement: "center-bottom",
  });
});

$(function () {
  attachCartHandlers();
  initDeferredMedia();
});
