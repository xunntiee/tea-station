import express from "express";
import path from "node:path";
import { z } from "zod";
import { hasTrevoApiKey, serverEnv } from "./env.mjs";
import {
  createPublicOrder,
  fetchPublicCatalog,
  getStorefrontOrderStatus,
  initPublicPayment,
} from "./trevo-client.mjs";

const app = express();
const immutableStaticOptions = {
  etag: true,
  lastModified: true,
  immutable: true,
  maxAge: "30d",
};
const regularStaticOptions = {
  etag: true,
  lastModified: true,
  maxAge: "7d",
};

function sendHtmlFile(res, filePath) {
  res.set("Cache-Control", "no-cache");
  res.sendFile(filePath);
}

function normalizeRouteSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProductsRoute(category) {
  const normalizedCategory = normalizeRouteSegment(category);
  return normalizedCategory ? `/products/${normalizedCategory}` : "/products";
}

function mountPrettyHtmlRoutes(rootDir) {
  app.get("/", (_req, res) => {
    sendHtmlFile(res, path.join(rootDir, "index.html"));
  });

  app.get("/index.html", (_req, res) => {
    res.redirect(302, "/");
  });

  app.get("/products", (_req, res) => {
    sendHtmlFile(res, path.join(rootDir, "products.html"));
  });

  app.get("/products.html", (req, res) => {
    const category = req.query?.["filter-category"];
    res.redirect(302, buildProductsRoute(category));
  });

  app.get("/products/:category", (_req, res) => {
    sendHtmlFile(res, path.join(rootDir, "products.html"));
  });

  app.get("/checkout", (_req, res) => {
    sendHtmlFile(res, path.join(rootDir, "checkout.html"));
  });

  app.get("/checkout.html", (req, res) => {
    const query = new URLSearchParams(
      Object.entries(req.query ?? {}).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((item) => [key, String(item)]);
        }

        if (value === undefined) {
          return [];
        }

        return [[key, String(value)]];
      }),
    );
    const suffix = query.toString();
    res.redirect(302, suffix ? `/checkout?${suffix}` : "/checkout");
  });
}

const checkoutSchema = z.object({
  customerName: z
    .string({ required_error: "Vui long nhap ho ten nguoi nhan" })
    .trim()
    .min(2, "Ten khach hang qua ngan"),
  customerPhone: z
    .string({ required_error: "Vui long nhap so dien thoai" })
    .trim()
    .refine((value) => /^(0|\+84)[0-9]{8,10}$/.test(value.replace(/\s+/g, "")), {
      message: "So dien thoai khong hop le",
    }),
  customerAddress: z
    .string({ required_error: "Vui long nhap dia chi giao hang" })
    .trim()
    .min(5, "Dia chi qua ngan"),
  notes: z.string().trim().max(500).optional(),
  promotionCode: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productId: z
          .string({ required_error: "San pham khong hop le" })
          .trim()
          .min(1),
        quantity: z
          .number({ required_error: "So luong san pham khong hop le" })
          .int()
          .positive()
          .max(50),
      }),
    )
    .min(1, "Can it nhat 1 san pham"),
});

app.use(express.json({ limit: "256kb" }));

app.get("/api/storefront/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      orgSlug: serverEnv.trevoOrgSlug,
      trevoApiBaseUrl: serverEnv.trevoApiBaseUrl,
      apiKeyConfigured: hasTrevoApiKey(),
    },
  });
});

app.get("/api/storefront/catalog", async (_req, res, next) => {
  try {
    const catalog = await fetchPublicCatalog();
    res.json({
      success: true,
      data: {
        ...catalog,
        source: hasTrevoApiKey()
          ? "public_catalog + external_status_ready"
          : "public_catalog",
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/storefront/checkout", async (req, res, next) => {
  try {
    const parsed = checkoutSchema.parse(req.body);
    const order = await createPublicOrder({
      ...parsed,
      customerPhone: parsed.customerPhone.replace(/\s+/g, ""),
      notes: parsed.notes?.trim() || undefined,
    });
    const payment = await initPublicPayment(order.id);

    res.status(201).json({
      success: true,
      data: {
        order,
        payment,
        statusEndpoint: `/api/storefront/orders/${order.id}/status`,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/storefront/orders/:orderId/status", async (req, res, next) => {
  try {
    const orderId = z.string().trim().min(1).parse(req.params.orderId);
    const status = await getStorefrontOrderStatus(orderId);
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/runtime-config.js", (_req, res) => {
  const runtimeConfig = {
    orgSlug: serverEnv.trevoOrgSlug,
    storefrontApiBaseUrl: serverEnv.storefrontApiBaseUrl,
    trevoApiBaseUrl: serverEnv.trevoApiBaseUrl,
    frontendBaseUrl: serverEnv.trevoFrontendBaseUrl,
    debug: serverEnv.debug,
  };

  res
    .set("Cache-Control", "no-cache")
    .type("application/javascript")
    .send(`window.__TREVO_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};\n`);
});

function mountProjectRootStatic() {
  app.use("/assets", express.static(path.join(serverEnv.projectRoot, "assets"), immutableStaticOptions));
  app.use("/css", express.static(path.join(serverEnv.projectRoot, "css"), regularStaticOptions));
  app.use("/dist", express.static(path.join(serverEnv.projectRoot, "dist"), regularStaticOptions));
  app.use("/js", express.static(path.join(serverEnv.projectRoot, "js"), regularStaticOptions));
  mountPrettyHtmlRoutes(serverEnv.projectRoot);
}

function mountPublishedSite() {
  app.use("/assets", express.static(path.join(serverEnv.siteDir, "assets"), immutableStaticOptions));
  app.use("/css", express.static(path.join(serverEnv.siteDir, "css"), regularStaticOptions));
  app.use("/dist", express.static(path.join(serverEnv.siteDir, "dist"), regularStaticOptions));
  app.use("/js", express.static(path.join(serverEnv.siteDir, "js"), regularStaticOptions));
  mountPrettyHtmlRoutes(serverEnv.siteDir);
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    const normalizedPath = req.path === "/" ? "/index.html" : req.path;
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(serverEnv.siteDir, normalizedPath), (error) => {
      if (error) {
        next();
      }
    });
  });
}

if (serverEnv.siteDir === serverEnv.projectRoot) {
  mountProjectRootStatic();
} else {
  mountPublishedSite();
}

app.use((error, _req, res, _next) => {
  const statusCode =
    error instanceof z.ZodError
      ? 400
      : Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 500;
  const message =
    error instanceof z.ZodError
      ? error.issues[0]?.message || "Du lieu gui len khong hop le"
      : error instanceof Error
        ? error.message
        : "Co loi xay ra tren Tea Station server";

  res.status(statusCode).json({
    success: false,
    message,
  });
});

app.listen(serverEnv.port, () => {
  console.log(
    `[Tea Station] running on http://127.0.0.1:${serverEnv.port} for org ${serverEnv.trevoOrgSlug}`,
  );
});
