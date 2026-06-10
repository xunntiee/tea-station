import { partnerLogos, partnerLogoBasePath } from "./data.js";
import { trevoConfig } from "./trevo-config.js";
import {
  fetchTrevoPublicCatalog,
  formatCurrencyVnd,
  normalizeProductCategory,
  resolveImageUrl,
} from "./trevo-api.js";

let trevoCatalogPromise = null;

async function loadTrevoCatalog() {
  if (!trevoCatalogPromise) {
    trevoCatalogPromise = fetchTrevoPublicCatalog().catch((error) => {
      trevoCatalogPromise = null;
      throw error;
    });
  }

  return trevoCatalogPromise;
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
    .toLowerCase()
    .trim();
}

function buildProductDescription(product) {
  const parts = [];

  if (product.categoryName) {
    parts.push(`Danh muc: ${product.categoryName}`);
  }

  if (product.sku) {
    parts.push(`SKU: ${product.sku}`);
  }

  parts.push(
    product.availableStock > 0
      ? `Con ${product.availableStock} san pham`
      : "Tam het hang",
  );

  return parts.join(" | ");
}

function getBestSellerPitch(product) {
  const categoryKey = normalizeProductCategory(product.categoryName);

  switch (categoryKey) {
    case "matcha":
      return "Hop cho nang luong sang, tap trung va lam viec cua ngay.";
    case "oolong":
      return "Huong vi can bang, thom sau va de thuong thuc moi luc.";
    case "whitetea":
      return "Nhe nhang, tinh te, phu hop nghi ngoi va thu gian.";
    case "blacktea":
      return "Dam vi, manh me va hop voi nguoi thich huong vi ro net.";
    default:
      return "Lua chon noi bat trong catalog Tea Station.";
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

const featuredCategoryOrder = ["matcha", "oolong", "whitetea", "blacktea"];

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
      ? `<span class="inline-flex rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Con hang</span>`
      : `<span class="inline-flex rounded-full bg-rose-500/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Het hang</span>`;

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
          <p class="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">${escapeHtml(product.categoryName ?? "San pham")}</p>
          <h3 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(product.name)}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(buildProductDescription(product))}</p>
          ${renderDebugMeta(product)}
        </div>

        <div class="flex items-end justify-between gap-4">
          <div>
            <p class="text-lg font-semibold text-slate-900">${escapeHtml(currentPrice)}</p>
            ${listPrice}
          </div>
          <a
            href="./checkout.html?products=${encodeURIComponent(`${product.id}:${Math.max(product.minOrderQty ?? 1, 1)}`)}"
            class="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 ${product.availableStock > 0 ? "" : "pointer-events-none opacity-50"}"
            ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
          >
            Dat ngay
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProductCard(selection) {
  const { product, config } = selection;
  const categoryKey = normalizeProductCategory(product.categoryName);
  const targetUrl = `./products.html?filter-category=${encodeURIComponent(categoryKey)}`;
  const quantity = Math.max(product.minOrderQty ?? 1, 1);
  const price = formatCurrencyVnd(product.salePrice);
  const stockLabel =
    product.availableStock > 0 ? `Con ${product.availableStock}` : "Tam het hang";
  const eyebrow = config?.eyebrow ?? "Tea Station Selection";
  const ctaLabel = config?.ctaLabel ?? "Dat ngay";

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
            ${escapeHtml(product.categoryName ?? "San pham")}
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
          <a
            href="./checkout.html?products=${encodeURIComponent(`${product.id}:${quantity}`)}"
            class="inline-flex items-center justify-center rounded-full bg-p-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-p-700 ${product.availableStock > 0 ? "" : "pointer-events-none opacity-50"}"
            ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
          >
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
        <a href="${targetUrl}" class="inline-flex text-sm font-medium text-p-700 transition hover:text-p-900">
          Xem theo danh muc
        </a>
      </div>
    </article>
  `;
}

function renderBestSellerSlide(selection) {
  const { product, config } = selection;
  const categoryLabel = product.categoryName ?? "San pham";
  const price = formatCurrencyVnd(product.salePrice);
  const stockLabel =
    product.availableStock > 0 ? `Con ${product.availableStock}` : "Tam het hang";
  const quantity = Math.max(product.minOrderQty ?? 1, 1);
  const pitch = config?.pitch ?? getBestSellerPitch(product);
  const eyebrow = config?.eyebrow ?? "Best seller";
  const ctaLabel = config?.ctaLabel ?? "Dat ngay";

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
          <a
            class="btn"
            href="./checkout.html?products=${encodeURIComponent(`${product.id}:${quantity}`)}"
            ${product.availableStock > 0 ? "" : 'aria-disabled="true"'}
          >
            ${escapeHtml(ctaLabel)}
          </a>
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
    return;
  }

  filterLinks.forEach((link) => link.classList.remove("activeFilter"));

  const category = new URLSearchParams(window.location.search).get("filter-category");
  switch (category) {
    case "whitetea":
      document.getElementById("f-whitetea")?.classList.add("activeFilter");
      break;
    case "oolong":
      document.getElementById("f-oolong")?.classList.add("activeFilter");
      break;
    case "blacktea":
      document.getElementById("f-blacktea")?.classList.add("activeFilter");
      break;
    case "matcha":
      document.getElementById("f-matcha")?.classList.add("activeFilter");
      break;
    default:
      document.getElementById("f-all")?.classList.add("activeFilter");
      break;
  }
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
      const category = product.categoryName ?? "San pham";
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
    <h3 class="mt-2 text-lg font-semibold text-slate-900">Catalog inspector dang bat</h3>
    <p class="mt-2 leading-6">
      Org: <code class="font-mono">${escapeHtml(trevoConfig.orgSlug)}</code><br />
      API: <code class="font-mono break-all">${escapeHtml(trevoConfig.apiBaseUrl)}</code><br />
      Frontend: <code class="font-mono break-all">${escapeHtml(trevoConfig.frontendBaseUrl)}</code>
    </p>
    <p class="mt-3 text-xs leading-5 text-slate-600">
      Copy SKU hoac ID ben duoi roi dan vao <code class="font-mono">preferredSkus</code> hoac <code class="font-mono">preferredIds</code> trong <code class="font-mono">js/trevo-config.js</code>.
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

/* ================
  All Products
=================== */
$(async function () {
  const container = document.getElementById("product-items--container");
  if (!container) {
    return;
  }

  setActiveFilterLink();
  renderProductState(container, "<p>Dang tai san pham tu Trevo...</p>");

  try {
    const catalog = await loadTrevoCatalog();
    const products = Array.isArray(catalog?.products) ? catalog.products : [];

    if (products.length === 0) {
      renderProductState(
        container,
        "<p class='text-lg font-medium text-slate-800'>Chua co san pham cong khai</p><p class='mt-2 text-sm'>Hay them san pham vao org tea-station trong Trevo roi quay lai.</p>",
      );
      return;
    }

    mountCatalogDebugPanel(container, products);
    container.innerHTML = products.map(renderProductCard).join("");

    if ($.fn.filterjitsu) {
      $.fn.filterjitsu();
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Khong ket noi duoc toi Trevo public API.";

    renderProductState(
      container,
      `<p class="text-lg font-medium text-slate-800">Khong tai duoc san pham</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
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

  renderTrevoSectionState(container, "<p>Dang tai san pham noi bat tu Trevo...</p>");

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
        "<p class='text-lg font-medium text-slate-800'>Chua co san pham noi bat cong khai</p><p class='mt-2 text-sm'>Hay bo sung san pham vao org tea-station trong Trevo.</p>",
      );
      return;
    }

    container.innerHTML = featuredProducts.map(renderFeaturedProductCard).join("");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Khong ket noi duoc toi Trevo public API.";

    renderTrevoSectionState(
      container,
      `<p class="text-lg font-medium text-slate-800">Khong tai duoc san pham noi bat</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
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

  renderBestSellerState(slider, "<p>Dang tai san pham ban chay tu Trevo...</p>");

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
        "<p class='text-lg font-medium text-slate-800'>Chua co san pham noi bat</p><p class='mt-2 text-sm'>Hay cap nhat san pham public trong org tea-station.</p>",
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
        : "Khong ket noi duoc toi Trevo public API.";

    renderBestSellerState(
      slider,
      `<p class="text-lg font-medium text-slate-800">Khong tai duoc san pham ban chay</p><p class="mt-2 text-sm">${escapeHtml(message)}</p>`,
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

  window.AOS.init({
    disable: false,
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
    once: false,
    mirror: true,
    anchorPlacement: "center-bottom",
  });
});
