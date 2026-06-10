# Tea Station

Tea Station da duoc nang len thanh mini fullstack storefront theo huong gan voi Nexis:

- frontend public de khach xem san pham
- backend rieng cua Tea Station giu secret
- backend Tea Station goi Trevo de lay catalog, tao don va init QR thanh toan

## Trang thai hien tai

- Phase 1: xong
  - homepage va `products.html` da doc catalog that tu Trevo
  - data hien theo org `tea-store`
- Phase 2: xong trong repo
  - Tea Station co backend rieng (`server/index.mjs`)
  - frontend goi `GET /api/storefront/catalog` thay vi goi thang Trevo
  - co `Dockerfile` de deploy chung Azure VM voi Trevo
- Phase 3: xong trong repo
  - `checkout.html` tao public order qua Tea Station backend
  - Tea Station backend xin QR SePay tu Trevo
  - frontend poll trang thai don hang sau thanh toan

## Kien truc moi

1. Browser -> Tea Station (`tea.trevo.studio`)
2. Tea Station backend -> Trevo public order API
3. Neu co `TREVO_API_KEY`, Tea Station co the doc order status qua external API
4. Khong co secret nao nam tren frontend runtime

## Env cua project

### 1. Env public cho frontend

Copy `.env.example` thanh `.env`.

Dung cho:

- `TREVO_ORG_SLUG`
- `TEA_STATION_API_BASE_URL`
- `TREVO_API_BASE_URL`
- `TREVO_FRONTEND_BASE_URL`
- `TREVO_DEBUG`

Luu y:

- file nay la public runtime config
- khong duoc dat `TREVO_API_KEY` vao day

### 2. Env private cho backend Tea Station

Copy `.env.server.example` thanh `.env.server`.

Quan trong nhat:

- `TREVO_API_KEY`
- `TREVO_API_ORIGIN`
- `TREVO_PUBLIC_PAYMENT_PROVIDER`

`TREVO_API_KEY` sinh ra de backend Tea Station noi chuyen an toan voi Trevo theo kieu server-to-server. Day la khac biet quan trong so voi landing page tinh.

## Chay local

```bash
npm install
npm run dev
```

Lenh `dev` se:

- sinh `runtime-config.js`
- watch Tailwind CSS
- chay Tea Station backend tai `http://127.0.0.1:3200`

Health check:

```txt
http://127.0.0.1:3200/api/storefront/health
```

## Build / publish

```bash
npm run publish
```

Lenh nay:

1. sinh `runtime-config.js`
2. build CSS
3. tao thu muc `site/`

## API noi bo cua Tea Station

- `GET /api/storefront/health`
- `GET /api/storefront/catalog`
- `POST /api/storefront/checkout`
- `GET /api/storefront/orders/:orderId/status`

## API key cua Trevo dung de lam gi

Trong Tea Station hien tai, `TREVO_API_KEY` duoc de o backend, khong de o frontend.

No phuc vu cho huong phat trien kieu Nexis:

- doc du lieu ERP dang bao ve
- theo doi order status server-side
- mo rong sau nay sang customer sync / stock sync / order sync

Neu chi la frontend tinh thi khong nen dat API key, vi se lo secret.

## Deploy production

Xem them [docs/deploy-production.md](./docs/deploy-production.md).
